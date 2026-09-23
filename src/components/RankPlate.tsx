import { Trophy } from 'lucide-react';
import styles from './RankPlate.module.css';

const PODIUM_CLASS: Record<number, string> = {
  1: styles.gold,
  2: styles.silver,
  3: styles.bronze,
};

export default function RankPlate({ rank, size = 'md' }: { rank: number | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  if (!rank) {
    return (
      <span className={`${styles.plate} ${styles[size]} ${styles.unranked}`} aria-label="Unranked">
        <Trophy size={size === 'lg' ? 20 : size === 'md' ? 16 : 13} />
      </span>
    );
  }
  return (
    <span className={`${styles.plate} ${styles[size]} ${PODIUM_CLASS[rank] ?? styles.field}`} aria-label={`Rank ${rank}`}>
      {rank}
    </span>
  );
}
