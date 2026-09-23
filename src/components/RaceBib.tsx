import type { CSSProperties } from 'react';
import type { Milestone, MilestoneKind } from '../lib/milestones';
import styles from './RaceBib.module.css';

const KIND_LABEL: Record<MilestoneKind, string> = {
  solves: 'Solved',
  streak: 'Streak',
  day: 'One day',
  rank: 'Leaderboard',
};

const TILTS = [-2.2, 1.6, -0.8, 2.4, -1.6, 0.9, -2.8, 1.2];

function formatEarnedOn(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface RaceBibProps {
  milestone: Milestone;
  index?: number;
  pinningIn?: boolean;
  pinDelayMs?: number;
  earnedOn?: string;
}

export default function RaceBib({ milestone, index = 0, pinningIn, pinDelayMs = 0, earnedOn }: RaceBibProps) {
  const { earned, kind } = milestone;
  const percent = Math.round((milestone.current / milestone.target) * 100);
  const earnedLabel = formatEarnedOn(earnedOn);

  const style = {
    '--tilt': earned ? `${TILTS[index % TILTS.length]}deg` : '0deg',
    '--pin-delay': `${pinDelayMs}ms`,
  } as CSSProperties;

  return (
    <div
      className={`${styles.bib} ${styles[kind]} ${earned ? styles.earned : styles.locked} ${
        pinningIn ? styles.pinningIn : ''
      }`}
      style={style}
      role="img"
      aria-label={`${milestone.name}: ${milestone.goal}. ${
        earned ? 'Earned.' : `${milestone.current} of ${milestone.target} so far.`
      }`}
    >
      <span className={`${styles.pin} ${styles.pinTL}`} />
      <span className={`${styles.pin} ${styles.pinTR}`} />
      <span className={`${styles.pin} ${styles.pinBL}`} />
      <span className={`${styles.pin} ${styles.pinBR}`} />

      <div className={styles.band}>
        <span>Pace</span>
        <span>{KIND_LABEL[kind]}</span>
      </div>

      <div className={styles.number}>
        <span className={styles.digits}>{milestone.bibNumber}</span>
        {milestone.bibUnit && <span className={styles.unit}>{milestone.bibUnit}</span>}
      </div>

      <div className={styles.name}>{milestone.name}</div>

      <div className={styles.footer}>
        {earned ? (
          <span className={styles.earnedOn}>{earnedLabel ? `Earned ${earnedLabel}` : 'Earned'}</span>
        ) : (
          <>
            <span className={styles.meter}>
              <span className={styles.meterFill} style={{ transform: `scaleX(${percent / 100})` }} />
            </span>
            <span className={`${styles.count} mono`}>
              {milestone.current}/{milestone.target}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function MiniBib({ milestone }: { milestone: Milestone }) {
  return (
    <span className={`${styles.mini} ${styles[milestone.kind]}`} aria-hidden="true">
      <span className={styles.miniBand} />
      <span className={styles.miniDigits}>{milestone.bibNumber}</span>
    </span>
  );
}
