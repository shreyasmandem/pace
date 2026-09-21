import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, BarChart3, Settings, Building2 } from 'lucide-react';
import styles from './MobileNav.module.css';

export default function MobileNav({ onOpenSearch }: { onOpenSearch: () => void }) {
  const location = useLocation();
  const isCompanyActive = location.pathname.startsWith('/compan');

  return (
    <nav className={styles.nav}>
      <NavLink to="/" end className={({ isActive }) => (isActive ? styles.active : styles.item)}>
        <div className={styles.iconWrapper}>
          <Home size={18} />
        </div>
        <span className={styles.label}>Home</span>
      </NavLink>

      <NavLink
        to="/companies"
        className={`${isCompanyActive ? styles.active : styles.item}`}
      >
        <div className={styles.iconWrapper}>
          <Building2 size={18} />
        </div>
        <span className={styles.label}>Companies</span>
      </NavLink>

      <button className={styles.item} onClick={onOpenSearch} aria-label="Search problems">
        <div className={styles.iconWrapper}>
          <Search size={18} />
        </div>
        <span className={styles.label}>Search</span>
      </button>

      <NavLink
        to="/stats"
        className={({ isActive }) => (isActive ? styles.active : styles.item)}
      >
        <div className={styles.iconWrapper}>
          <BarChart3 size={18} />
        </div>
        <span className={styles.label}>Progress</span>
      </NavLink>

      <NavLink
        to="/settings"
        className={({ isActive }) => (isActive ? styles.active : styles.item)}
      >
        <div className={styles.iconWrapper}>
          <Settings size={18} />
        </div>
        <span className={styles.label}>Settings</span>
      </NavLink>
    </nav>
  );
}
