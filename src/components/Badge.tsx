import type { CSSProperties } from 'react';
import { Check, Flame, Trophy, Zap, type LucideIcon } from 'lucide-react';
import type { Milestone, MilestoneKind } from '../lib/milestones';
import styles from './Badge.module.css';

const KIND_ICON: Record<MilestoneKind, LucideIcon> = {
  solves: Check,
  streak: Flame,
  day: Zap,
  rank: Trophy,
};

const RING_RADIUS = 34;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function formatEarnedOn(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface BadgeProps {
  milestone: Milestone;
  unlocking?: boolean;
  unlockDelayMs?: number;
  earnedOn?: string;
}

export default function Badge({ milestone, unlocking, unlockDelayMs = 0, earnedOn }: BadgeProps) {
  const { earned, kind } = milestone;
  const Icon = KIND_ICON[kind];
  const fraction = milestone.current / milestone.target;
  const earnedLabel = formatEarnedOn(earnedOn);

  return (
    <div
      className={`${styles.badge} ${styles[kind]} ${earned ? styles.earned : styles.locked} ${
        unlocking ? styles.unlocking : ''
      }`}
      style={{ '--unlock-delay': `${unlockDelayMs}ms` } as CSSProperties}
      role="img"
      aria-label={`${milestone.name}: ${milestone.goal}. ${
        earned ? 'Earned.' : `${milestone.current} of ${milestone.target} so far.`
      }`}
    >
      <div className={styles.medal}>
        {!earned && (
          <svg className={styles.ring} viewBox="0 0 76 76" aria-hidden="true">
            <circle cx="38" cy="38" r={RING_RADIUS} className={styles.ringTrack} />
            <circle
              cx="38"
              cy="38"
              r={RING_RADIUS}
              className={styles.ringFill}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
              transform="rotate(-90 38 38)"
            />
          </svg>
        )}
        <div className={styles.disc}>
          <span className={styles.emblem}>{milestone.emblem}</span>
          {milestone.emblemUnit && <span className={styles.unit}>{milestone.emblemUnit}</span>}
        </div>
        <span className={styles.kindIcon}>
          <Icon size={11} strokeWidth={2.75} />
        </span>
      </div>

      <div className={styles.name}>{milestone.name}</div>
      <div className={`${styles.meta} ${earned ? '' : 'mono'}`}>
        {earned ? (earnedLabel ? `Earned ${earnedLabel}` : milestone.goal) : `${milestone.current}/${milestone.target}`}
      </div>
    </div>
  );
}

export function MiniBadge({ milestone }: { milestone: Milestone }) {
  return (
    <span className={`${styles.mini} ${styles[milestone.kind]}`} aria-hidden="true">
      {milestone.emblem}
    </span>
  );
}
