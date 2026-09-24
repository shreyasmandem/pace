import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Info, AlertTriangle, CheckCircle, Bell, X } from 'lucide-react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import SearchPalette from './SearchPalette';
import Celebrations from './Celebrations';
import { usePaceStore } from '../state/store';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { subscribeBroadcast, type BroadcastAnnouncement } from '../lib/admin';
import styles from './Layout.module.css';

export default function Layout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  const sidebarCollapsed = usePaceStore((s) => s.sidebarCollapsed);
  const isDesktop = useIsDesktop(1080);

  const [broadcast, setBroadcast] = useState<BroadcastAnnouncement | null>(null);
  const [dismissedBroadcastId, setDismissedBroadcastId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('pace_dismissed_broadcast');
    } catch {
      return null;
    }
  });

  const [moderationNotice, setModerationNotice] = useState<{ type: 'deleted' | 'suspended'; message: string } | null>(() => {
    try {
      if (sessionStorage.getItem('pace_account_suspended_notice') === 'true') {
        return {
          type: 'suspended',
          message: 'Your account has been suspended by an administrator. Access to cloud synchronization and leaderboard has been disabled.',
        };
      }
      if (sessionStorage.getItem('pace_account_deleted_notice') === 'true') {
        return {
          type: 'deleted',
          message: 'Your account was deleted by an administrator. You must sign up with Google again to create a new account.',
        };
      }
    } catch {
      // ignore
    }
    return null;
  });

  useEffect(() => {
    function onAccountStatus(e: any) {
      const status = e?.detail?.status;
      if (status === 'suspended') {
        setModerationNotice({
          type: 'suspended',
          message: 'Your account has been suspended by an administrator. Access to cloud synchronization and leaderboard has been disabled.',
        });
      } else if (status === 'deleted') {
        setModerationNotice({
          type: 'deleted',
          message: 'Your account was deleted by an administrator. You must sign up with Google again to create a new account.',
        });
      }
    }
    window.addEventListener('pace-account-status', onAccountStatus);
    return () => window.removeEventListener('pace-account-status', onAccountStatus);
  }, []);

  const handleDismissModerationNotice = () => {
    setModerationNotice(null);
    try {
      sessionStorage.removeItem('pace_account_suspended_notice');
      sessionStorage.removeItem('pace_account_deleted_notice');
    } catch {
      // ignore
    }
  };

  // Listen to live broadcast announcement
  useEffect(() => {
    return subscribeBroadcast((announcement) => {
      setBroadcast(announcement);
    });
  }, []);

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

  const handleDismissBroadcast = () => {
    if (broadcast) {
      const id = `${broadcast.updatedAt}_${broadcast.message.slice(0, 10)}`;
      setDismissedBroadcastId(id);
      try {
        sessionStorage.setItem('pace_dismissed_broadcast', id);
      } catch {
        // ignore
      }
    }
  };

  const isCollapsed = isDesktop && sidebarCollapsed;
  const currentBroadcastId = broadcast ? `${broadcast.updatedAt}_${broadcast.message.slice(0, 10)}` : null;
  const showBroadcast = broadcast && broadcast.active && broadcast.message && currentBroadcastId !== dismissedBroadcastId;

  return (
    <div className={styles.shell}>
      <Sidebar onOpenSearch={() => setSearchOpen(true)} />
      <main className={`${styles.main} ${isCollapsed ? styles.mainCollapsed : ''}`}>
        {showBroadcast && (
          <div
            className={`${styles.broadcastBanner} ${
              broadcast.type === 'warning'
                ? styles.broadcastWarning
                : broadcast.type === 'alert'
                ? styles.broadcastAlert
                : broadcast.type === 'success'
                ? styles.broadcastSuccess
                : styles.broadcastInfo
            }`}
          >
            <div className={styles.broadcastContent}>
              {broadcast.type === 'warning' ? (
                <AlertTriangle size={15} />
              ) : broadcast.type === 'alert' ? (
                <AlertTriangle size={15} />
              ) : broadcast.type === 'success' ? (
                <CheckCircle size={15} />
              ) : (
                <Info size={15} />
              )}
              <span>{broadcast.message}</span>
              {broadcast.link && (
                <a
                  href={broadcast.link}
                  target={broadcast.link.startsWith('http') ? '_blank' : '_self'}
                  rel="noreferrer"
                  className={styles.broadcastLink}
                >
                  {broadcast.linkText || 'Learn more →'}
                </a>
              )}
            </div>
            <button
              type="button"
              className={styles.broadcastCloseBtn}
              onClick={handleDismissBroadcast}
              aria-label="Dismiss banner"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {moderationNotice && (
          <div className={`${styles.broadcastBanner} ${styles.broadcastAlert}`}>
            <div className={styles.broadcastContent}>
              <AlertTriangle size={15} />
              <span>{moderationNotice.message}</span>
            </div>
            <button
              type="button"
              className={styles.broadcastCloseBtn}
              onClick={handleDismissModerationNotice}
              aria-label="Dismiss notice"
            >
              <X size={15} />
            </button>
          </div>
        )}

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
