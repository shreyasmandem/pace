import { NavLink, useLocation } from 'react-router-dom';
import { Flame, Search, Settings, BarChart3, Building2, CalendarDays } from 'lucide-react';
import { TRACK_META, TRACK_ORDER } from '../data';
import { useTrackStats } from '../hooks/useTrackStats';
import { usePaceStore } from '../state/store';
import { currentStreak } from '../state/store';
import Lane from './Lane';
import ThemeToggle from './ThemeToggle';
import AccountButton from './AccountButton';
import styles from './Sidebar.module.css';

export default function Sidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const location = useLocation();
  const stats = useTrackStats();
  const solveLog = usePaceStore((s) => s.solveLog);
  const registeredTracks = usePaceStore((s) => s.registeredTracks || []);
  const streak = currentStreak(solveLog);

  const isCompanyActive = location.pathname.startsWith('/compan');

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
          to="/planner"
          className={({ isActive }) => `${styles.utilityLink} ${isActive ? styles.active : ''}`}
        >
          <CalendarDays size={15} />
          <span>Roadmap &amp; Planner</span>
        </NavLink>
        <NavLink
          to="/companies"
          className={`${styles.utilityLink} ${isCompanyActive ? styles.active : ''}`}
        >
          <Building2 size={15} />
          <span>Company DSA</span>
          <span className={styles.navBadge}>500+</span>
        </NavLink>
        <NavLink
          to="/stats"
          className={({ isActive }) => `${styles.utilityLink} ${isActive ? styles.active : ''}`}
        >
          <BarChart3 size={15} />
          <span>Progress &amp; streaks</span>
        </NavLink>
      </nav>

      <div className={styles.tracks}>
        <span className={styles.tracksHeading}>Enrolled Tracks</span>
        {registeredTracks.length === 0 ? (
          <div style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            <span>No tracks enrolled.</span>
            <NavLink
              to="/settings"
              style={{
                display: 'block',
                marginTop: '4px',
                color: 'var(--accent)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              + Register tracks →
            </NavLink>
          </div>
        ) : (
          <ul>
            {registeredTracks.map((id) => {
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
            {registeredTracks.length < TRACK_ORDER.length && (
              <li>
                <NavLink
                  to="/settings"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    color: 'var(--text-tertiary)',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-sm)',
                    marginTop: '4px',
                  }}
                >
                  <span>+ Explore more tracks</span>
                </NavLink>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.streak}>
          <Flame key={streak} size={15} className={streak > 0 ? styles.flameActive : styles.flameIdle} />
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
