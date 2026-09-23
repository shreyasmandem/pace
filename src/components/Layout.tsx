import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import SearchPalette from './SearchPalette';
import Celebrations from './Celebrations';
import styles from './Layout.module.css';

export default function Layout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  // Close search palette whenever the route changes
  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={styles.shell}>
      <Sidebar onOpenSearch={() => setSearchOpen(true)} />
      <main className={styles.main}>
        <div key={location.pathname} className={styles.pageTransition}>
          <Outlet />
        </div>
      </main>
      <MobileNav onOpenSearch={() => setSearchOpen(true)} />
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
      <Celebrations />
    </div>
  );
}
