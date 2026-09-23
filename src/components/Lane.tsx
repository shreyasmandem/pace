import styles from './Lane.module.css';

interface LaneProps {
  percent: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Lane({ percent, color, size = 'md' }: LaneProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const showHead = size !== 'sm' && clamped > 0 && clamped < 100;
  return (
    <div
      className={`${styles.lane} ${styles[size]}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={styles.fill}
        style={{ transform: `scaleX(${clamped / 100})`, background: color ?? 'var(--accent)' }}
      />
      {showHead && (
        <div className={styles.headTrack} style={{ transform: `translateX(${clamped - 100}%)` }}>
          <span key={Math.round(clamped * 10)} className={styles.head} />
        </div>
      )}
    </div>
  );
}
