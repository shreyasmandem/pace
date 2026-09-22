import { useState, useMemo } from 'react';
import { Flame, Zap, Calendar, TrendingUp } from 'lucide-react';
import { currentStreak } from '../state/store';
import { longestStreak } from '../lib/leaderboard';
import styles from './InteractiveHeatmap.module.css';

const WEEKS = 24;
const DAY_MS = 86_400_000;

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function levelFor(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function InteractiveHeatmap({
  solveLog = {},
}: {
  solveLog: Record<string, number>;
}) {
  const [inspectedDay, setInspectedDay] = useState<{
    date: string;
    count: number;
  } | null>(null);

  const streak = currentStreak(solveLog);
  const maxStreak = longestStreak(solveLog);

  // Total active days & total problems logged in solveLog
  const activeDaysCount = useMemo(() => {
    return Object.keys(solveLog).filter((k) => (solveLog[k] || 0) > 0).length;
  }, [solveLog]);

  const totalLoggedSolves = useMemo(() => {
    return Object.values(solveLog).reduce((sum, n) => sum + (n || 0), 0);
  }, [solveLog]);

  const avgSolves = activeDaysCount
    ? (totalLoggedSolves / activeDaysCount).toFixed(1)
    : '0';

  const { cols, monthMarkers } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDow = today.getDay(); // 0 = Sun
    const totalDays = WEEKS * 7;
    const start = new Date(
      today.getTime() - (totalDays - 1 - (6 - endDow)) * DAY_MS
    );

    const columns: { date: string; count: number }[][] = [];
    const months: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;

    let cursor = new Date(start);
    for (let w = 0; w < WEEKS; w++) {
      const col: { date: string; count: number }[] = [];
      const m = cursor.getMonth();
      if (m !== lastMonth) {
        months.push({
          label: cursor.toLocaleDateString(undefined, { month: 'short' }),
          colIndex: w,
        });
        lastMonth = m;
      }

      for (let d = 0; d < 7; d++) {
        const iso = isoOf(cursor);
        col.push({ date: iso, count: solveLog[iso] || 0 });
        cursor = new Date(cursor.getTime() + DAY_MS);
      }
      columns.push(col);
    }

    return { cols: columns, monthMarkers: months };
  }, [solveLog]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>Solve Activity Heatmap</span>
          <span className={styles.badge}>Last 6 Months</span>
        </div>

        <div className={styles.inspectBox}>
          {inspectedDay ? (
            <span>
              <span className={styles.inspectBold}>
                {inspectedDay.count}{' '}
                {inspectedDay.count === 1 ? 'problem' : 'problems'} solved
              </span>{' '}
              on {formatDisplayDate(inspectedDay.date)}
            </span>
          ) : (
            <span style={{ color: 'var(--text-tertiary)' }}>
              Hover or tap any square to inspect activity
            </span>
          )}
        </div>
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.heatmapWrapper}>
          {/* Month labels */}
          <div className={styles.monthRow}>
            {monthMarkers.map((mm, idx) => (
              <span
                key={idx}
                style={{
                  gridColumnStart: mm.colIndex + 1,
                  display: 'inline-block',
                  width: '45px',
                }}
              >
                {mm.label}
              </span>
            ))}
          </div>

          <div className={styles.gridRow}>
            {/* Day of week labels */}
            <div className={styles.dayLabels}>
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>

            {/* Matrix */}
            <div className={styles.grid}>
              {cols.map((col, cIdx) => (
                <div key={cIdx} className={styles.col}>
                  {col.map((day) => {
                    const isSelected = inspectedDay?.date === day.date;
                    const level = levelFor(day.count);
                    return (
                      <div
                        key={day.date}
                        className={`${styles.cell} ${styles[`level${level}`]} ${
                          isSelected ? styles.cellSelected : ''
                        }`}
                        onMouseEnter={() => setInspectedDay(day)}
                        onClick={() => setInspectedDay(day)}
                        aria-label={`${day.count} solved on ${day.date}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.statsStrip}>
          <div className={styles.statItem}>
            <Flame size={14} color="var(--accent)" />
            <span>Streak:</span>
            <span className={styles.statVal}>{streak}d</span>
          </div>

          <div className={styles.statItem}>
            <Zap size={14} color="#f0b429" />
            <span>Longest:</span>
            <span className={styles.statVal}>{maxStreak}d</span>
          </div>

          <div className={styles.statItem}>
            <Calendar size={14} color="var(--text-secondary)" />
            <span>Active Days:</span>
            <span className={styles.statVal}>{activeDaysCount}</span>
          </div>

          <div className={styles.statItem}>
            <TrendingUp size={14} color="var(--difficulty-easy)" />
            <span>Velocity:</span>
            <span className={styles.statVal}>{avgSolves}/day</span>
          </div>
        </div>

        <div className={styles.legend}>
          <span>Less</span>
          <span className={`${styles.legendCell} ${styles.level0}`} />
          <span className={`${styles.legendCell} ${styles.level1}`} />
          <span className={`${styles.legendCell} ${styles.level2}`} />
          <span className={`${styles.legendCell} ${styles.level3}`} />
          <span className={`${styles.legendCell} ${styles.level4}`} />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
