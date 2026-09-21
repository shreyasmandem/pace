import { TRACK_META, TRACK_ORDER } from '../data';
import { useAggregateStat, useTrackStats } from '../hooks/useTrackStats';
import { usePaceStore, currentStreak } from '../state/store';
import Lane from '../components/Lane';
import StreakHeatmap from '../components/StreakHeatmap';
import styles from './Stats.module.css';

export default function Stats() {
  const aggregate = useAggregateStat();
  const trackStats = useTrackStats();
  const solveLog = usePaceStore((s) => s.solveLog);
  const streak = currentStreak(solveLog);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Progress &amp; streaks</h1>

      <section className={styles.summary}>
        <div>
          <span className={`${styles.summaryValue} numeric`}>{aggregate.solved}</span>
          <span className={styles.summaryLabel}>problems solved of {aggregate.total}</span>
        </div>
        <div>
          <span className={`${styles.summaryValue} numeric`}>{streak}</span>
          <span className={styles.summaryLabel}>day streak</span>
        </div>
        <div>
          <span className={`${styles.summaryValue} numeric`}>{Object.keys(solveLog).length}</span>
          <span className={styles.summaryLabel}>active days logged</span>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Solve activity</h2>
        <StreakHeatmap solveLog={solveLog} />
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>By track</h2>
        <div className={styles.trackList}>
          {TRACK_ORDER.map((id) => {
            const meta = TRACK_META[id];
            const stat = trackStats[id];
            return (
              <div key={id} className={styles.trackRow}>
                <span className={styles.trackName}>{meta.shortLabel}</span>
                <Lane percent={stat.percent} color={meta.accent} />
                <span className={`${styles.trackFraction} mono`}>
                  {stat.solved}/{stat.total}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
