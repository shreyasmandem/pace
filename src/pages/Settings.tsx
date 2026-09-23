import { useRef, useState, useEffect } from 'react';
import { Download, Moon, Sun, Upload, Monitor, LogOut, Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { usePaceStore, currentStreak } from '../state/store';
import type { Theme, TutorLanguage } from '../state/store';
import type { TrackId } from '../types';
import { TRACK_ORDER, TRACK_META, getTrack } from '../data';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuthUser, useSyncStatus, notifyProfileUpdated } from '../hooks/useAuth';
import { signInWithGoogle, signOut, firebaseEnabled, updateUserDisplayName } from '../lib/firebase';
import { updateLeaderboardDisplayName, publishToLeaderboard, calculateWeeklySolves } from '../lib/leaderboard';
import styles from './Settings.module.css';

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const TUTOR_LANGUAGES: { id: TutorLanguage; name: string; icon: string; desc: string }[] = [
  {
    id: 'python',
    name: 'Python 3',
    icon: '🐍',
    desc: 'PEP 8, deque, heapq, defaultdict, tuples, slices',
  },
  {
    id: 'cpp',
    name: 'C++ (C++17/20)',
    icon: '⚡',
    desc: 'STL vectors, priority_queue, unordered_map, structured bindings',
  },
  {
    id: 'java',
    name: 'Java',
    icon: '☕',
    desc: 'Collections, ArrayDeque, PriorityQueue, StringBuilder',
  },
  {
    id: 'javascript',
    name: 'JavaScript (ES6+)',
    icon: '🟨',
    desc: 'ES6+, Map, Set, array methods, modern idioms',
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    icon: '🔷',
    desc: 'Typed DSA, interface TreeNode/ListNode, Map<K, V>',
  },
  {
    id: 'go',
    name: 'Go (Golang)',
    icon: '🐹',
    desc: 'Slices, maps, container/heap, idiomatic Go',
  },
  {
    id: 'rust',
    name: 'Rust',
    icon: '🦀',
    desc: 'Vec, VecDeque, BinaryHeap, pattern matching',
  },
  {
    id: 'neutral',
    name: 'Language Neutral',
    icon: '🌐',
    desc: 'Conceptual, pseudocode & versatile multi-language',
  },
];

export default function Settings() {
  const theme = usePaceStore((s) => s.theme);
  const setTheme = usePaceStore((s) => s.setTheme);
  const tutorLanguage = usePaceStore((s) => s.tutorLanguage || 'python');
  const setTutorLanguage = usePaceStore((s) => s.setTutorLanguage);
  const registeredTracks = usePaceStore((s) => s.registeredTracks || []);
  const registerTrack = usePaceStore((s) => s.registerTrack);
  const unregisterTrack = usePaceStore((s) => s.unregisterTrack);
  const exportSnapshot = usePaceStore((s) => s.exportSnapshot);
  const importSnapshot = usePaceStore((s) => s.importSnapshot);
  const resetAll = usePaceStore((s) => s.resetAll);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [unregisteringTrackId, setUnregisteringTrackId] = useState<TrackId | null>(null);
  const { user } = useAuthUser();
  const syncStatus = useSyncStatus();
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [displayNameInput, setDisplayNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayNameInput(user.displayName || (user.email ? user.email.split('@')[0] : ''));
    }
  }, [user?.displayName, user?.email]);

  async function handleSaveDisplayName(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = displayNameInput.trim();
    if (!trimmed) {
      setNameError('Display name cannot be empty.');
      return;
    }
    if (trimmed.length < 2) {
      setNameError('Display name must be at least 2 characters.');
      return;
    }
    if (!user) return;

    setNameError(null);
    setNameSuccess(null);
    setSavingName(true);
    try {
      await updateUserDisplayName(trimmed);
      await updateLeaderboardDisplayName(user.uid, trimmed);
      notifyProfileUpdated();
      setNameSuccess('Display name updated! Visible across Pace and leaderboards.');
      setTimeout(() => setNameSuccess(null), 3500);
    } catch (err: any) {
      setNameError(err?.message || 'Failed to update display name. Please try again.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleSignIn() {
    setAuthError(null);
    setSigningIn(true);
    try {
      const cred = await signInWithGoogle();
      if (cred?.user) {
        const store = usePaceStore.getState();
        publishToLeaderboard(cred.user.uid, cred.user, {
          solvedCount: Object.keys(store.progress || {}).length,
          streak: currentStreak(store.solveLog || {}),
          weeklyCount: calculateWeeklySolves(store.solveLog || {}),
          activeDays: Object.keys(store.solveLog || {}).length,
        });
      }
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

              {/* Editable Display Name Block */}
              <div className={styles.displayNameBlock}>
                <label className={styles.displayNameLabel} htmlFor="globalDisplayName">
                  Global Display Name
                </label>
                <form className={styles.displayNameForm} onSubmit={handleSaveDisplayName}>
                  <input
                    id="globalDisplayName"
                    type="text"
                    className={styles.displayNameInput}
                    value={displayNameInput}
                    onChange={(e) => {
                      setDisplayNameInput(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    placeholder="Enter your name"
                    maxLength={32}
                    autoComplete="name"
                  />
                  <button
                    type="submit"
                    className={styles.saveNameBtn}
                    disabled={
                      savingName ||
                      !displayNameInput.trim() ||
                      displayNameInput.trim() === (user.displayName || '')
                    }
                  >
                    {savingName ? 'Saving…' : 'Save Name'}
                  </button>
                </form>
                <p className={styles.displayNameHint}>
                  This name is displayed publicly on the community leaderboard and in your Pace dashboard greeting.
                </p>
                {nameSuccess && (
                  <div className={styles.nameSuccessText}>
                    <Check size={14} />
                    <span>{nameSuccess}</span>
                  </div>
                )}
                {nameError && (
                  <div className={styles.nameErrorText}>
                    <AlertCircle size={14} />
                    <span>{nameError}</span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 'var(--space-4)' }}>
                <button className={styles.actionButton} onClick={() => signOut()}>
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.blockText}>
                Sign in with Google to sync progress, notes, and bookmarks across every device — and compete on the global leaderboard.
              </p>
              <div>
                <button className={styles.googleActionBtn} onClick={handleSignIn} disabled={signingIn}>
                  <svg className={styles.googleIconSm} viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{signingIn ? 'Signing in…' : 'Sign in with Google'}</span>
                </button>
              </div>
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
        <h2 className={styles.blockTitle}>Pacer AI Tutor Language</h2>
        <p className={styles.blockText}>
          Choose your primary programming language for Pacer AI tutor. Code walkthroughs, hints, standard library recommendations, and algorithmic idioms will be customized to your choice.
        </p>
        <div className={styles.selectWrapper}>
          <select
            className={styles.languageSelect}
            value={tutorLanguage}
            onChange={(e) => setTutorLanguage(e.target.value as TutorLanguage)}
          >
            {TUTOR_LANGUAGES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.icon} {item.name} — {item.desc}
              </option>
            ))}
          </select>
        </div>
        <p className={styles.selectHelperText}>
          Active language: <strong>{TUTOR_LANGUAGES.find((l) => l.id === tutorLanguage)?.name || 'Python 3'}</strong>. Pacer will deliver explanations and hints tailored to this language.
        </p>
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
                        onClick={() => setUnregisteringTrackId(id)}
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

      {unregisteringTrackId && (
        <ConfirmDialog
          title={`Unregister from ${TRACK_META[unregisteringTrackId].label}?`}
          body={`Warning: All your solved progress, bookmarks, and personal notes in ${TRACK_META[unregisteringTrackId].label} will be permanently deleted and reset to 0. Are you sure you want to unregister?`}
          confirmLabel="Unregister & Delete Progress"
          onConfirm={() => {
            unregisterTrack(unregisteringTrackId);
            setUnregisteringTrackId(null);
          }}
          onCancel={() => setUnregisteringTrackId(null)}
        />
      )}
    </div>
  );
}
