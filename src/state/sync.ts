import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { usePaceStore } from './store';

export type SyncStatus = 'signed-out' | 'syncing' | 'synced' | 'offline';

type SyncableState = {
  progress: Record<string, boolean>;
  notes: Record<string, string>;
  bookmarks: Record<string, boolean>;
  solveLog: Record<string, number>;
};

const SYNC_FIELDS: (keyof SyncableState)[] = ['progress', 'notes', 'bookmarks', 'solveLog'];

function pickSyncable(state: ReturnType<typeof usePaceStore.getState>): SyncableState {
  return {
    progress: state.progress,
    notes: state.notes,
    bookmarks: state.bookmarks,
    solveLog: state.solveLog,
  };
}

function mergeBooleanMaps(a: Record<string, boolean>, b: Record<string, boolean>) {
  return { ...a, ...b }; // union: true from either side wins, since both maps only ever hold `true`.
}

function mergeNotes(local: Record<string, string>, remote: Record<string, string>) {
  const merged: Record<string, string> = { ...remote };
  for (const [id, text] of Object.entries(local)) {
    if (text.trim() && !merged[id]) merged[id] = text;
  }
  return merged;
}

function mergeSolveLog(a: Record<string, number>, b: Record<string, number>) {
  const merged: Record<string, number> = { ...a };
  for (const [day, count] of Object.entries(b)) {
    merged[day] = Math.max(merged[day] || 0, count);
  }
  return merged;
}

function mergeSyncable(local: SyncableState, remote: SyncableState): SyncableState {
  return {
    progress: mergeBooleanMaps(local.progress, remote.progress),
    notes: mergeNotes(local.notes, remote.notes),
    bookmarks: mergeBooleanMaps(local.bookmarks, remote.bookmarks),
    solveLog: mergeSolveLog(local.solveLog, remote.solveLog),
  };
}

let unsubscribeSnapshot: Unsubscribe | null = null;
let unsubscribeStore: (() => void) | null = null;
let applyingRemoteUpdate = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let currentUid: string | null = null;

const listeners = new Set<(status: SyncStatus) => void>();
let status: SyncStatus = 'signed-out';
function setStatus(next: SyncStatus) {
  status = next;
  listeners.forEach((l) => l(status));
}
export function subscribeSyncStatus(listener: (status: SyncStatus) => void) {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}

function stopListening() {
  unsubscribeSnapshot?.();
  unsubscribeSnapshot = null;
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  currentUid = null;
}

function pushToFirestore(uid: string) {
  if (!db) return;
  const payload = pickSyncable(usePaceStore.getState());
  setDoc(doc(db, 'users', uid), { ...payload, updatedAt: Date.now() }, { merge: true })
    .then(() => setStatus('synced'))
    .catch(() => setStatus('offline')); // queued locally by Firestore's persistent cache; will retry on reconnect
}

function schedulePush(uid: string) {
  if (pushTimer) clearTimeout(pushTimer);
  setStatus('syncing');
  pushTimer = setTimeout(() => pushToFirestore(uid), 800);
}

async function startSyncing(user: User) {
  if (!db) return;
  currentUid = user.uid;
  setStatus('syncing');

  const ref = doc(db, 'users', user.uid);

  unsubscribeSnapshot = onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.hasPendingWrites) return; // our own optimistic write echoing back

      if (!snap.exists()) {
        // First sign-in on this account: seed the remote doc from whatever's local.
        pushToFirestore(user.uid);
        return;
      }

      const remote = snap.data() as Partial<SyncableState>;
      const local = pickSyncable(usePaceStore.getState());
      const merged = mergeSyncable(local, {
        progress: remote.progress || {},
        notes: remote.notes || {},
        bookmarks: remote.bookmarks || {},
        solveLog: remote.solveLog || {},
      });

      applyingRemoteUpdate = true;
      usePaceStore.setState(merged);
      applyingRemoteUpdate = false;

      setStatus(snap.metadata.fromCache ? 'offline' : 'synced');

      // If merging pulled in anything the remote doc didn't have yet, push the merge back.
      const changed = SYNC_FIELDS.some(
        (k) => JSON.stringify(merged[k]) !== JSON.stringify(remote[k] || {})
      );
      if (changed) schedulePush(user.uid);
    },
    () => setStatus('offline')
  );

  unsubscribeStore = usePaceStore.subscribe((state, prevState) => {
    if (applyingRemoteUpdate) return;
    const changed = SYNC_FIELDS.some((k) => state[k] !== prevState[k]);
    if (changed && currentUid) schedulePush(currentUid);
  });
}

/** Call once at app startup. */
export function initSync() {
  if (!auth) {
    setStatus('signed-out');
    return () => {};
  }
  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    stopListening();
    if (user) startSyncing(user);
    else setStatus('signed-out');
  });
  return unsubscribeAuth;
}
