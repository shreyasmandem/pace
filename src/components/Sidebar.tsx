import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Flame,
  Search,
  Settings,
  BarChart3,
  Building2,
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from 'lucide-react';
import { TRACK_META, TRACK_ORDER } from '../data';
import { useTrackStats } from '../hooks/useTrackStats';
import { usePaceStore, currentStreak } from '../state/store';
import { useAuthUser } from '../hooks/useAuth';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { isPaceAdmin } from '../lib/admin';
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

  const sidebarCollapsed = usePaceStore((s) => s.sidebarCollapsed);
  const toggleSidebar = usePaceStore((s) => s.toggleSidebar);

  const isDesktop = useIsDesktop(1080);
  const { user } = useAuthUser();
  const isAdmin = isPaceAdmin(user);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar on desktop
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSidebar]);

  const isCompanyActive = location.pathname.startsWith('/compan');
  const isAdminActive = location.pathname.startsWith('/admin');

  // True collapsed state only on PC when user chose to collapse
  const isCollapsed = isDesktop && sidebarCollapsed;

  return (
    <aside
      className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}
      aria-label="Main Navigation"
    >
      {/* Brand Header */}
      <div className={styles.brandRow}>
        <NavLink
          to="/"
          className={styles.brand}
          title={isCollapsed ? 'Pace Dashboard' : undefined}
        >
          <img src="/pace-mark.png" alt="Pace" className={styles.mark} />
          {!isCollapsed && <span className={styles.wordmark}>PACE</span>}
        </NavLink>

        {isDesktop && !isCollapsed && (
          <button
            type="button"
            className={styles.toggleCollapseBtn}
            onClick={toggleSidebar}
            title="Minimize sidebar (Ctrl+B)"
            aria-label="Minimize sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        )}

        {isDesktop && isCollapsed && (
          <button
            type="button"
            className={styles.toggleExpandBtn}
            onClick={toggleSidebar}
            title="Expand sidebar (Ctrl+B)"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}
      </div>

      {/* Search Bar */}
      <button
        type="button"
        className={styles.searchTrigger}
        onClick={onOpenSearch}
        title={isCollapsed ? 'Search problems (⌘K)' : undefined}
      >
        <Search size={16} />
        {!isCollapsed && (
          <>
            <span>Search problems</span>
            <kbd className={styles.kbd}>⌘K</kbd>
          </>
        )}
      </button>

      {/* Main Nav */}
      <nav className={styles.nav}>
        <NavLink
          to="/planner"
          className={({ isActive }) => `${styles.utilityLink} ${isActive ? styles.active : ''}`}
          title={isCollapsed ? 'Roadmap & Planner' : undefined}
        >
          <CalendarDays size={16} />
          {!isCollapsed && <span>Roadmap &amp; Planner</span>}
        </NavLink>

        <NavLink
          to="/companies"
          className={`${styles.utilityLink} ${isCompanyActive ? styles.active : ''}`}
          title={isCollapsed ? 'Company DSA (500+)' : undefined}
        >
          <Building2 size={16} />
          {!isCollapsed && (
            <>
              <span>Company DSA</span>
              <span className={styles.navBadge}>500+</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/stats"
          className={({ isActive }) => `${styles.utilityLink} ${isActive ? styles.active : ''}`}
          title={isCollapsed ? 'Progress & streaks' : undefined}
        >
          <BarChart3 size={16} />
          {!isCollapsed && <span>Progress &amp; streaks</span>}
        </NavLink>
      </nav>

      {/* Enrolled Tracks */}
      <div className={styles.tracks}>
        {!isCollapsed && <span className={styles.tracksHeading}>Enrolled Tracks</span>}

        {registeredTracks.length === 0 ? (
          !isCollapsed ? (
            <div className={styles.noTracksBox}>
              <span>No tracks enrolled.</span>
              <NavLink to="/settings" className={styles.registerTrackLink}>
                + Register tracks →
              </NavLink>
            </div>
          ) : (
            <NavLink
              to="/settings"
              className={styles.collapsedAddTrack}
              title="Register tracks"
            >
              +
            </NavLink>
          )
        ) : (
          <ul className={styles.trackList}>
            {registeredTracks.map((id) => {
              const meta = TRACK_META[id];
              const stat = stats[id];
              const titleTooltip = `${meta.label}: ${stat.solved}/${stat.total} solved (${Math.round(stat.percent)}%)`;

              if (isCollapsed) {
                return (
                  <li key={id}>
                    <NavLink
                      to={`/track/${id}`}
                      className={({ isActive }) =>
                        `${styles.collapsedTrackTile} ${isActive ? styles.active : ''}`
                      }
                      title={titleTooltip}
                    >
                      <span className={styles.collapsedTrackLabel}>{meta.shortLabel}</span>
                      <div
                        className={styles.collapsedTrackDot}
                        style={{ background: meta.accent }}
                      />
                    </NavLink>
                  </li>
                );
              }

              return (
                <li key={id}>
                  <NavLink
                    to={`/track/${id}`}
                    className={({ isActive }) => `${styles.trackRow} ${isActive ? styles.active : ''}`}
                    title={titleTooltip}
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

            {!isCollapsed && registeredTracks.length < TRACK_ORDER.length && (
              <li>
                <NavLink to="/settings" className={styles.exploreTracksLink}>
                  <span>+ Explore more tracks</span>
                </NavLink>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        {/* Admin Section (Strictly PC + Shreyas Mandem only, subtle & docked above streak/settings) */}
        {isDesktop && isAdmin && (
          <div className={styles.adminSection}>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `${styles.utilityLink} ${styles.adminLink} ${isActive ? styles.active : ''}`
              }
              title={isCollapsed ? 'Admin Panel' : undefined}
            >
              <ShieldCheck size={16} />
              {!isCollapsed && <span>Admin Panel</span>}
            </NavLink>
          </div>
        )}

        <div className={styles.footerRow}>
          <div
            className={styles.streak}
            title={`${streak} day active streak`}
          >
            <Flame
              key={streak}
              size={16}
              className={streak > 0 ? styles.flameActive : styles.flameIdle}
            />
            {!isCollapsed && (
              <span>
                <span className="numeric">{streak}</span> day{streak === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className={styles.footerActions}>
            <ThemeToggle />
            <NavLink
              to="/settings"
              className={styles.iconButton}
              aria-label="Settings"
              title={isCollapsed ? 'Settings' : undefined}
            >
              <Settings size={16} />
            </NavLink>
            <AccountButton />
          </div>
        </div>
      </div>
    </aside>
  );
}
