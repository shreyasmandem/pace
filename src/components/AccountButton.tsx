import { NavLink } from 'react-router-dom';
import { CloudOff, LogIn, RefreshCw, Cloud } from 'lucide-react';
import { useAuthUser, useSyncStatus } from '../hooks/useAuth';
import styles from './AccountButton.module.css';

export default function AccountButton() {
  const { user } = useAuthUser();
  const status = useSyncStatus();

  if (!user) {
    return (
      <NavLink to="/login" className={styles.button} aria-label="Log in or Sign up" title="Log in / Sign up">
        <LogIn size={16} />
      </NavLink>
    );
  }

  const StatusIcon = status === 'syncing' ? RefreshCw : status === 'offline' ? CloudOff : Cloud;
  const label =
    status === 'syncing' ? 'Syncing…' : status === 'offline' ? 'Offline — will sync' : 'Synced';

  return (
    <NavLink to="/settings" className={styles.button} aria-label={`Account — ${label}`} title={label}>
      {user.photoURL ? (
        <img src={user.photoURL} alt="" className={styles.avatar} />
      ) : (
        <span className={styles.initial}>{(user.displayName || user.email || '?')[0].toUpperCase()}</span>
      )}
      <StatusIcon size={11} className={`${styles.statusIcon} ${styles[status]}`} />
    </NavLink>
  );
}
