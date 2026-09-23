import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Flame, Zap, Calendar, TrendingUp } from 'lucide-react';
import { currentStreak } from '../state/store';
import { longestStreak } from '../lib/leaderboard';
import styles from './InteractiveHeatmap.module.css';

const DESKTOP_WEEKS = 53;
const PHONE_WEEKS = 24;
const PHONE_QUERY = '(max-width: 640px)';
const DAY_MS = 86_400_000;
const DAY_LABELS: Record<number, string> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };

// Solve-log keys are UTC dates (the store writes toISOString().slice(0, 10)),
// so the grid is built in UTC too; otherwise every square is off by a day east of UTC.
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
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const onChange = () => setIsPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isPhone;
}

interface Day {
  date: string;
  count: number;
  week: number;
  dow: number;
  future: boolean;
}

export default function InteractiveHeatmap({ solveLog = {} }: { solveLog: Record<string, number> }) {
  const isPhone = useIsPhone();
  const weeks = isPhone ? PHONE_WEEKS : DESKTOP_WEEKS;
  const [inspectedDay, setInspectedDay] = useState<Day | null>(null);

  const streak = currentStreak(solveLog);
  const maxStreak = longestStreak(solveLog);

  const activeDaysCount = useMemo(
    () => Object.keys(solveLog).filter((k) => (solveLog[k] || 0) > 0).length,
    [solveLog]
  );
  const totalLoggedSolves = useMemo(
    () => Object.values(solveLog).reduce((sum, n) => sum + (n || 0), 0),
    [solveLog]
  );
  const avgSolves = activeDaysCount ? (totalLoggedSolves / activeDaysCount).toFixed(1) : '0';

  const { days, months, rangeTotal } = useMemo(() => {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const start = new Date(today.getTime() - ((weeks - 1) * 7 + today.getUTCDay()) * DAY_MS);

    const cells: Day[] = [];
    const markers: { label: string; week: number }[] = [];
    let total = 0;

    for (let w = 0; w < weeks; w++) {
      const weekStart = new Date(start.getTime() + w * 7 * DAY_MS);
      const prevWeekStart = new Date(weekStart.getTime() - 7 * DAY_MS);
      if (w === 0 || weekStart.getUTCMonth() !== prevWeekStart.getUTCMonth()) {
        markers.push({
          label: weekStart.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }),
          week: w,
        });
      }
      for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart.getTime() + d * DAY_MS);
        const iso = isoOf(date);
        const future = date.getTime() > today.getTime();
        const count = future ? 0 : solveLog[iso] || 0;
        total += count;
        cells.push({ date: iso, count, week: w, dow: d, future });
      }
    }

    // Like GitHub: drop a month label that would collide with the next one.
    const visibleMarkers = markers.filter((m, i) => {
      const next = markers[i + 1];
      return !next || next.week - m.week >= 3;
    });

    return { days: cells, months: visibleMarkers, rangeTotal: total };
  }, [solveLog, weeks]);

  const gridStyle = { '--weeks': weeks } as CSSProperties;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.title}>Solve activity</span>
          <span className={styles.rangeTotal}>
            <strong>{rangeTotal}</strong> {rangeTotal === 1 ? 'solve' : 'solves'} in the{' '}
            {isPhone ? 'last 6 months' : 'past year'}
          </span>
        </div>

        <div className={styles.inspectBox}>
          {inspectedDay ? (
            <span>
              <span className={styles.inspectBold}>
                {inspectedDay.count} {inspectedDay.count === 1 ? 'problem' : 'problems'}
              </span>{' '}
              on {formatDisplayDate(inspectedDay.date)}
            </span>
          ) : (
            <span className={styles.inspectHint}>
              {isPhone ? 'Tap a square for details' : 'Hover a square for details'}
            </span>
          )}
        </div>
      </div>

      <div className={styles.grid} style={gridStyle} onMouseLeave={() => setInspectedDay(null)}>
        {months.map((m) => (
          <span key={`m-${m.week}`} className={styles.monthLabel} style={{ gridColumn: `${m.week + 2} / span ${Math.min(3, weeks - m.week)}` }}>
            {m.label}
          </span>
        ))}

        {Object.entries(DAY_LABELS).map(([dow, label]) => (
          <span key={`d-${dow}`} className={styles.dayLabel} style={{ gridRow: Number(dow) + 2 }}>
            {label}
          </span>
        ))}

        {days.map((day) =>
          day.future ? (
            <span
              key={day.date}
              className={styles.futureCell}
              style={{ gridColumn: day.week + 2, gridRow: day.dow + 2 }}
            />
          ) : (
            <button
              key={day.date}
              type="button"
              className={`${styles.cell} ${styles[`level${levelFor(day.count)}`]} ${
                inspectedDay?.date === day.date ? styles.cellSelected : ''
              }`}
              style={{ gridColumn: day.week + 2, gridRow: day.dow + 2, '--week': day.week } as CSSProperties}
              onMouseEnter={() => setInspectedDay(day)}
              onFocus={() => setInspectedDay(day)}
              onClick={() => setInspectedDay(day)}
              aria-label={`${day.count} solved on ${formatDisplayDate(day.date)}`}
            />
          )
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.statsStrip}>
          <div className={styles.statItem}>
            <Flame size={14} color="var(--accent)" />
            <span>Streak</span>
            <span className={styles.statVal}>{streak}d</span>
          </div>
          <div className={styles.statItem}>
            <Zap size={14} color="var(--difficulty-medium)" />
            <span>Longest</span>
            <span className={styles.statVal}>{maxStreak}d</span>
          </div>
          <div className={styles.statItem}>
            <Calendar size={14} color="var(--text-secondary)" />
            <span>Active days</span>
            <span className={styles.statVal}>{activeDaysCount}</span>
          </div>
          <div className={styles.statItem}>
            <TrendingUp size={14} color="var(--difficulty-easy)" />
            <span>Per active day</span>
            <span className={styles.statVal}>{avgSolves}</span>
          </div>
        </div>

        <div className={styles.legend} aria-hidden="true">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`${styles.legendCell} ${styles[`level${l}`]}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
