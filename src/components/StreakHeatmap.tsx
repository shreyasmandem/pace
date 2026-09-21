import { useMemo } from 'react';
import styles from './StreakHeatmap.module.css';

const WEEKS = 20;
const DAY_MS = 86_400_000;

function isoOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

function levelFor(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

export default function StreakHeatmap({ solveLog }: { solveLog: Record<string, number> }) {
  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Align the grid so the last column ends on today's weekday column.
    const endDow = today.getDay();
    const totalDays = WEEKS * 7;
    const start = new Date(today.getTime() - (totalDays - 1 - (6 - endDow)) * DAY_MS);

    const cols: { date: string; count: number }[][] = [];
    let cursor = new Date(start);
    for (let w = 0; w < WEEKS; w++) {
      const col: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const iso = isoOf(cursor);
        col.push({ date: iso, count: solveLog[iso] || 0 });
        cursor = new Date(cursor.getTime() + DAY_MS);
      }
      cols.push(col);
    }
    return cols;
  }, [solveLog]);

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        {weeks.map((col, i) => (
          <div key={i} className={styles.col}>
            {col.map((day) => (
              <div
                key={day.date}
                className={`${styles.cell} ${styles[`level${levelFor(day.count)}`]}`}
                title={`${day.count} solved on ${day.date}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className={styles.legend}>
        <span>Less</span>
        <span className={`${styles.cell} ${styles.level0}`} />
        <span className={`${styles.cell} ${styles.level1}`} />
        <span className={`${styles.cell} ${styles.level2}`} />
        <span className={`${styles.cell} ${styles.level3}`} />
        <span className={`${styles.cell} ${styles.level4}`} />
        <span>More</span>
      </div>
    </div>
  );
}
