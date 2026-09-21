import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import SearchPalette from './SearchPalette';
import styles from './Layout.module.css';

export default function Layout() {
  const [searchOpen, setSearchOpen] = useState(false);

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
        <Outlet />
      </main>
      <MobileNav onOpenSearch={() => setSearchOpen(true)} />
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
