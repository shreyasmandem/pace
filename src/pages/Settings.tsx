import { useRef, useState } from 'react';
import { Download, Moon, Sun, Upload, Monitor, LogOut, Cloud, CloudOff, RefreshCw, Check } from 'lucide-react';
import { usePaceStore } from '../state/store';
import type { Theme } from '../state/store';
import { TRACK_ORDER, TRACK_META, getTrack } from '../data';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuthUser, useSyncStatus } from '../hooks/useAuth';
import { signInWithGoogle, signOut, firebaseEnabled } from '../lib/firebase';
import styles from './Settings.module.css';

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function Settings() {
  const theme = usePaceStore((s) => s.theme);
  const setTheme = usePaceStore((s) => s.setTheme);
  const registeredTracks = usePaceStore((s) => s.registeredTracks || []);
  const registerTrack = usePaceStore((s) => s.registerTrack);
  const unregisterTrack = usePaceStore((s) => s.unregisterTrack);
  const exportSnapshot = usePaceStore((s) => s.exportSnapshot);
  const importSnapshot = usePaceStore((s) => s.importSnapshot);
  const resetAll = usePaceStore((s) => s.resetAll);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const { user } = useAuthUser();
  const syncStatus = useSyncStatus();
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  async function handleSignIn() {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setAuthError('Sign-in was cancelled or failed. Try again.');
    } finally {
      setSigningIn(false);
    }
  }

  function handleExport() {
    const blob = new Blob([exportSnapshot()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pace-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importSnapshot(String(reader.result));
      setImportMessage(ok ? 'Progress imported successfully.' : "That file couldn't be read as a Pace export.");
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Settings</h1>

      {firebaseEnabled && (
        <section className={styles.block}>
          <h2 className={styles.blockTitle}>Account</h2>
          {user ? (
            <>
              <div className={styles.accountRow}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className={styles.accountAvatar} />
                ) : (
                  <span className={styles.accountInitial}>
                    {(user.displayName || user.email || '?')[0].toUpperCase()}
                  </span>
                )}
                <div>
                  <p className={styles.accountName}>{user.displayName || user.email}</p>
                  <p className={styles.accountSyncStatus}>
                    {syncStatus === 'syncing' && (
                      <>
                        <RefreshCw size={12} className={styles.spinning} /> Syncing…
                      </>
                    )}
                    {syncStatus === 'synced' && (
                      <>
                        <Cloud size={12} /> Synced across your devices
                      </>
                    )}
                    {syncStatus === 'offline' && (
                      <>
                        <CloudOff size={12} /> Offline — changes will sync when you're back online
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button className={styles.actionButton} onClick={() => signOut()}>
                <LogOut size={15} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className={styles.blockText}>
                Sign in with Google to sync progress, notes, and bookmarks across every device — sign in
                on your phone and pick up exactly where you left off.
              </p>
              <button className={styles.actionButton} onClick={handleSignIn} disabled={signingIn}>
                <Cloud size={15} />
                {signingIn ? 'Signing in…' : 'Sign in with Google'}
              </button>
              {authError && <p className={styles.importMessage}>{authError}</p>}
            </>
          )}
        </section>
      )}

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Appearance</h2>
        <div className={styles.themeOptions}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              className={`${styles.themeOption} ${theme === value ? styles.themeOptionActive : ''}`}
              onClick={() => setTheme(value)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Curriculums & Tracks</h2>
        <p className={styles.blockText}>
          Manage your enrolled tracks. Only problems, personal stats, and search results for registered tracks are active across your workspace. You can register or unregister at any time.
        </p>
        <div className={styles.trackEnrollmentList}>
          {TRACK_ORDER.map((id) => {
            const meta = TRACK_META[id];
            const track = getTrack(id);
            const total = track.groups.reduce((acc, g) => acc + g.problems.length, 0);
            const enrolled = registeredTracks.includes(id);

            return (
              <div key={id} className={styles.trackEnrollmentRow}>
                <div className={styles.trackEnrollmentInfo}>
                  <div className={styles.trackEnrollmentName}>
                    {meta.label}
                  </div>
                  <span className={styles.trackEnrollmentCount}>
                    {total} problems • {meta.source}
                  </span>
                </div>
                <div className={styles.trackEnrollmentRight}>
                  {enrolled ? (
                    <>
                      <span className={styles.enrolledBadge}>
                        <Check size={12} style={{ strokeWidth: 3 }} /> Enrolled
                      </span>
                      <button
                        className={styles.unregisterTrackBtn}
                        onClick={() => unregisterTrack(id)}
                        title="Unregister from this track"
                      >
                        Unregister
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={styles.notEnrolledBadge}>Not Enrolled</span>
                      <button
                        className={styles.registerTrackBtn}
                        onClick={() => registerTrack(id)}
                        title="Register for this track"
                      >
                        + Register
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Backup</h2>
        <p className={styles.blockText}>
          {user
            ? "Your progress already syncs to your account, but you can still export a local backup file any time."
            : 'Progress, notes, and bookmarks live only in this browser until you sign in above. Export a backup before clearing your browser data.'}
        </p>
        <div className={styles.buttonRow}>
          <button className={styles.actionButton} onClick={handleExport}>
            <Download size={15} />
            Export progress
          </button>
          <button className={styles.actionButton} onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} />
            Import progress
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className={styles.hiddenInput}
            onChange={handleImportFile}
          />
        </div>
        {importMessage && <p className={styles.importMessage}>{importMessage}</p>}
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Danger zone</h2>
        <p className={styles.blockText}>
          Clear all solved progress, bookmarks, personal notes, and Pacer AI tutor chat history across every track and company. Export a backup first if you might want it back.
        </p>
        <button className={styles.dangerButton} onClick={() => setConfirmingReset(true)}>
          Reset all progress
        </button>
      </section>

      {confirmingReset && (
        <ConfirmDialog
          title="Reset all progress?"
          body="This will permanently delete all your solved progress, bookmarks, personal notes, and Pacer AI tutor chat history across every track and company. This cannot be undone."
          confirmLabel="Reset everything"
          onConfirm={() => {
            resetAll();
            setConfirmingReset(false);
          }}
          onCancel={() => setConfirmingReset(false)}
        />
      )}
    </div>
  );
}
