import { NavLink } from 'react-router-dom';
import { Flame, Search, Settings, BarChart3 } from 'lucide-react';
import { TRACK_META, TRACK_ORDER } from '../data';
import { useTrackStats } from '../hooks/useTrackStats';
import { usePaceStore } from '../state/store';
import { currentStreak } from '../state/store';
import Lane from './Lane';
import ThemeToggle from './ThemeToggle';
import AccountButton from './AccountButton';
import styles from './Sidebar.module.css';

export default function Sidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const stats = useTrackStats();
  const solveLog = usePaceStore((s) => s.solveLog);
  const streak = currentStreak(solveLog);

  return (
    <aside className={styles.sidebar}>
      <NavLink to="/" className={styles.brand}>
        <img src="/pace-mark.png" alt="" className={styles.mark} />
        <span className={styles.wordmark}>Pace</span>
      </NavLink>

      <button className={styles.searchTrigger} onClick={onOpenSearch}>
        <Search size={15} />
        <span>Search problems</span>
        <kbd className={styles.kbd}>⌘K</kbd>
      </button>

      <nav className={styles.nav}>
        <NavLink
          to="/stats"
          className={({ isActive }) => `${styles.utilityLink} ${isActive ? styles.active : ''}`}
        >
          <BarChart3 size={15} />
          Progress &amp; streaks
        </NavLink>
      </nav>

      <div className={styles.tracks}>
        <span className={styles.tracksHeading}>Tracks</span>
        <ul>
          {TRACK_ORDER.map((id) => {
            const meta = TRACK_META[id];
            const stat = stats[id];
            return (
              <li key={id}>
                <NavLink
                  to={`/track/${id}`}
                  className={({ isActive }) => `${styles.trackRow} ${isActive ? styles.active : ''}`}
                >
                  <span className={styles.trackTop}>
                    <span className={styles.trackName}>{meta.shortLabel}</span>
                    <span className={`${styles.trackFraction} mono`}>
                      {stat.solved}/{stat.total}
                    </span>
                  </span>
                  <Lane percent={stat.percent} color={meta.accent} size="sm" />
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.footer}>
        <div className={styles.streak}>
          <Flame size={15} className={streak > 0 ? styles.flameActive : styles.flameIdle} />
          <span>
            <span className="numeric">{streak}</span> day{streak === 1 ? '' : 's'}
          </span>
        </div>
        <div className={styles.footerActions}>
          <ThemeToggle />
          <NavLink to="/settings" className={styles.iconButton} aria-label="Settings">
            <Settings size={16} />
          </NavLink>
          <AccountButton />
        </div>
      </div>
    </aside>
  );
}
