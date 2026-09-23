import { useEffect, useMemo, useState } from 'react';
import {
  bestDay,
  computeMilestones,
  markBadgesSeen,
  readBadgeEarnedDates,
  readSeenBadges,
} from '../lib/milestones';
import Badge from './Badge';
import styles from './AchievementBadges.module.css';

const UNLOCK_STAGGER_MS = 110;
const MAX_UNLOCK_STAGGER_MS = 900;

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

  // Snapshot of badges already seen when the wall first rendered, so badges earned
  // since the last visit play the unlock animation exactly once.
  const [seenAtMount] = useState(readSeenBadges);
  const earnedDates = readBadgeEarnedDates();

  const earnedIds = milestones.filter((m) => m.earned).map((m) => m.id);
  const earnedKey = earnedIds.join(',');
  useEffect(() => {
    markBadgesSeen(earnedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earnedKey]);

  const earnedCount = earnedIds.length;
  const nextUp = milestones
    .filter((m) => !m.earned && m.kind !== 'rank')
    .sort((a, b) => b.current / b.target - a.current / a.target)[0];

  let unlockOrder = 0;

  return (
    <section className={styles.wall} aria-labelledby="badge-wall-title">
      <header className={styles.header}>
        <div>
          <h2 id="badge-wall-title" className={styles.title}>
            Badges
          </h2>
          <p className={styles.subtitle}>
            {earnedCount === 0 ? 'Solve your first problem to earn your first badge.' : `${earnedCount} of ${milestones.length} earned.`}
            {nextUp && earnedCount > 0 && (
              <>
                {' '}
                Next: <strong>{nextUp.name}</strong>, {nextUp.target - nextUp.current}{' '}
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
        {milestones.map((m) => {
          const unlocking = m.earned && !seenAtMount[m.id];
          const delay = unlocking ? Math.min(unlockOrder++ * UNLOCK_STAGGER_MS, MAX_UNLOCK_STAGGER_MS) : 0;
          return (
            <Badge
              key={m.id}
              milestone={m}
              unlocking={unlocking}
              unlockDelayMs={delay}
              earnedOn={earnedDates[m.id]}
            />
          );
        })}
      </div>
    </section>
  );
}
