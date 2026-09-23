import { useEffect, useMemo, useState } from 'react';
import {
  bestDay,
  computeMilestones,
  markBibsPinned,
  readBibEarnedDates,
  readPinnedBibs,
} from '../lib/milestones';
import RaceBib from './RaceBib';
import styles from './AchievementBadges.module.css';

const PIN_STAGGER_MS = 110;
const MAX_PIN_STAGGER_MS = 900;

export default function AchievementBadges({
  solvedCount = 0,
  streak = 0,
  maxStreak = 0,
  solveLog = {},
  userRank = null,
}: {
  solvedCount: number;
  streak: number;
  maxStreak: number;
  solveLog: Record<string, number>;
  userRank?: number | null;
}) {
  const milestones = useMemo(
    () =>
      computeMilestones({
        solved: solvedCount,
        bestStreak: Math.max(streak, maxStreak),
        bestDay: bestDay(solveLog),
        rank: userRank,
      }),
    [solvedCount, streak, maxStreak, solveLog, userRank]
  );

  // Snapshot of what was already pinned when the wall first rendered, so bibs earned
  // since the last visit play the pin-on animation exactly once.
  const [pinnedAtMount] = useState(readPinnedBibs);
  const earnedDates = readBibEarnedDates();

  const earnedIds = milestones.filter((m) => m.earned).map((m) => m.id);
  const earnedKey = earnedIds.join(',');
  useEffect(() => {
    markBibsPinned(earnedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earnedKey]);

  const earnedCount = earnedIds.length;
  const nextUp = milestones
    .filter((m) => !m.earned && m.kind !== 'rank')
    .sort((a, b) => b.current / b.target - a.current / a.target)[0];

  let pinOrder = 0;

  return (
    <section className={styles.wall} aria-labelledby="bib-wall-title">
      <header className={styles.header}>
        <div>
          <h2 id="bib-wall-title" className={styles.title}>
            Race bibs
          </h2>
          <p className={styles.subtitle}>
            {earnedCount === 0
              ? 'Solve your first problem to pin your first bib.'
              : `${earnedCount} of ${milestones.length} pinned.`}
            {nextUp && earnedCount > 0 && (
              <>
                {' '}
                Next up: <strong>{nextUp.name}</strong>, {nextUp.target - nextUp.current}{' '}
                {nextUp.kind === 'solves' ? 'to go' : nextUp.kind === 'streak' ? 'more days' : 'more in a day'}.
              </>
            )}
          </p>
        </div>
        <span className={`${styles.tally} mono`}>
          {earnedCount}/{milestones.length}
        </span>
      </header>

      <div className={styles.grid}>
        {milestones.map((m, i) => {
          const pinningIn = m.earned && !pinnedAtMount[m.id];
          const delay = pinningIn ? Math.min(pinOrder++ * PIN_STAGGER_MS, MAX_PIN_STAGGER_MS) : 0;
          return (
            <RaceBib
              key={m.id}
              milestone={m}
              index={i}
              pinningIn={pinningIn}
              pinDelayMs={delay}
              earnedOn={earnedDates[m.id]}
            />
          );
        })}
      </div>
    </section>
  );
}
