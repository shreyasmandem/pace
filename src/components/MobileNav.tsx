import { NavLink } from 'react-router-dom';
import { Home, Search, BarChart3, Settings, Building2 } from 'lucide-react';
import styles from './MobileNav.module.css';

export default function MobileNav({ onOpenSearch }: { onOpenSearch: () => void }) {
  return (
    <nav className={styles.nav}>
      <NavLink to="/" end className={({ isActive }) => (isActive ? styles.active : styles.item)}>
        <Home size={19} />
        <span>Home</span>
      </NavLink>
      <NavLink
        to="/companies"
        className={({ isActive }) =>
          isActive || window.location.hash.includes('/company') ? styles.active : styles.item
        }
      >
        <Building2 size={19} />
        <span>Companies</span>
      </NavLink>
      <button className={styles.item} onClick={onOpenSearch}>
        <Search size={19} />
        <span>Search</span>
      </button>
      <NavLink to="/stats" className={({ isActive }) => (isActive ? styles.active : styles.item)}>
        <BarChart3 size={19} />
        <span>Progress</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => (isActive ? styles.active : styles.item)}>
        <Settings size={19} />
        <span>Settings</span>
      </NavLink>
    </nav>
  );
}
