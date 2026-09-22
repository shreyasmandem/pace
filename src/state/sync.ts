import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { usePaceStore, currentStreak, type PlanItem, type TrackId } from './store';
import { publishToLeaderboard, calculateWeeklySolves } from '../lib/leaderboard';

export type SyncStatus = 'signed-out' | 'syncing' | 'synced' | 'offline';

type SyncableState = {
  progress: Record<string, boolean>;
  notes: Record<string, string>;
  bookmarks: Record<string, boolean>;
  solveLog: Record<string, number>;
  planner: Record<string, PlanItem[]>;
  registeredTracks: TrackId[];
};

const SYNC_FIELDS: (keyof SyncableState)[] = [
  'progress',
  'notes',
  'bookmarks',
  'solveLog',
  'planner',
  'registeredTracks',
];

function cleanProgressMap(map: Record<string, boolean> | undefined): Record<string, boolean> {
  const clean: Record<string, boolean> = {};
  if (!map) return clean;
  for (const [k, v] of Object.entries(map)) {
    if (v === true) clean[k] = true;
  }
  return clean;
}

function cleanNotesMap(map: Record<string, string> | undefined): Record<string, string> {
  const clean: Record<string, string> = {};
  if (!map) return clean;
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === 'string' && v.trim()) clean[k] = v;
  }
  return clean;
}

function cleanBookmarksMap(map: Record<string, boolean> | undefined): Record<string, boolean> {
  const clean: Record<string, boolean> = {};
  if (!map) return clean;
  for (const [k, v] of Object.entries(map)) {
    if (v === true) clean[k] = true;
  }
  return clean;
}

function cleanPlannerMap(map: Record<string, PlanItem[]> | undefined): Record<string, PlanItem[]> {
  const clean: Record<string, PlanItem[]> = {};
  if (!map) return clean;
  for (const [k, v] of Object.entries(map)) {
    if (Array.isArray(v) && v.length > 0) clean[k] = v;
  }
  return clean;
}

function cleanRegisteredTracks(list: any): TrackId[] {
  if (!Array.isArray(list)) return [];
  const valid: TrackId[] = ['a2z', 'nc150', 'nc250', 'blind75'];
  return list.filter((id) => valid.includes(id));
}

function pickSyncable(state: ReturnType<typeof usePaceStore.getState>): SyncableState {
  return {
    progress: cleanProgressMap(state.progress),
    notes: cleanNotesMap(state.notes),
    bookmarks: cleanBookmarksMap(state.bookmarks),
    solveLog: state.solveLog || {},
    planner: cleanPlannerMap(state.planner),
    registeredTracks: cleanRegisteredTracks(state.registeredTracks),
  };
}

function mergeSolveLog(a: Record<string, number> | undefined, b: Record<string, number> | undefined) {
  const merged: Record<string, number> = { ...(b || {}) };
  for (const [day, count] of Object.entries(a || {})) {
    merged[day] = Math.max(merged[day] || 0, count);
  }
  return merged;
}

function mapsEqual(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => {
    if (typeof a[k] === 'object' && a[k] !== null && typeof b[k] === 'object' && b[k] !== null) {
      return JSON.stringify(a[k]) === JSON.stringify(b[k]);
    }
    return a[k] === b[k];
  });
}

let unsubscribeSnapshot: Unsubscribe | null = null;
let unsubscribeStore: (() => void) | null = null;
let applyingRemoteUpdate = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let currentUid: string | null = null;
let lastPushedAt = 0;
let isInitialLoad = true;

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
  lastPushedAt = 0;
  isInitialLoad = true;
}

function pushToFirestore(uid: string) {
  if (!db) return;
  const payload = pickSyncable(usePaceStore.getState());
  const now = Date.now();
  lastPushedAt = now;

  // Use mergeFields so that deleted keys inside maps are completely overwritten and removed
  setDoc(
    doc(db, 'users', uid),
    {
      progress: payload.progress,
      notes: payload.notes,
      bookmarks: payload.bookmarks,
      solveLog: payload.solveLog,
      planner: payload.planner,
      registeredTracks: payload.registeredTracks,
      resetVersion: 2,
      updatedAt: now,
    },
    { mergeFields: ['progress', 'notes', 'bookmarks', 'solveLog', 'planner', 'registeredTracks', 'resetVersion', 'updatedAt'] }
  )
    .then(() => {
      setStatus('synced');
      publishToLeaderboard(uid, auth?.currentUser ?? null, {
        solvedCount: Object.keys(payload.progress).length,
        streak: currentStreak(payload.solveLog),
        weeklyCount: calculateWeeklySolves(payload.solveLog),
        activeDays: Object.keys(payload.solveLog).length,
      });
    })
    .catch(() => setStatus('offline'));
}

function schedulePush(uid: string) {
  if (pushTimer) clearTimeout(pushTimer);
  setStatus('syncing');
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushToFirestore(uid);
  }, 500);
}

async function startSyncing(user: User) {
  if (!db) return;
  currentUid = user.uid;
  isInitialLoad = true;
  setStatus('syncing');

  const ref = doc(db, 'users', user.uid);

  unsubscribeSnapshot = onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snap) => {
      // Ignore in-flight local writes
      if (snap.metadata.hasPendingWrites) return;

      if (!snap.exists()) {
        // First sign-in on this account: seed remote doc from local
        isInitialLoad = false;
        pushToFirestore(user.uid);
        return;
      }

      const remoteData = snap.data() as Partial<SyncableState & { updatedAt?: number; resetVersion?: number }>;
      const remoteUpdatedAt = remoteData?.updatedAt || 0;

      // Check if remote data needs the global v2 reset
      if (!remoteData?.resetVersion || remoteData.resetVersion < 2) {
        isInitialLoad = false;
        const cleanReset: SyncableState = {
          progress: {},
          notes: cleanNotesMap(remoteData.notes),
          bookmarks: cleanBookmarksMap(remoteData.bookmarks),
          solveLog: {},
          planner: cleanPlannerMap(remoteData.planner),
          registeredTracks: [],
        };
        applyingRemoteUpdate = true;
        usePaceStore.setState(cleanReset);
        applyingRemoteUpdate = false;
        pushToFirestore(user.uid);
        return;
      }

      // Update public leaderboard entry for this user
      const remoteProg = cleanProgressMap(remoteData?.progress);
      const remoteLog = remoteData?.solveLog || {};
      publishToLeaderboard(user.uid, user, {
        solvedCount: Object.keys(remoteProg).length,
        streak: currentStreak(remoteLog),
        weeklyCount: calculateWeeklySolves(remoteLog),
        activeDays: Object.keys(remoteLog).length,
      });

      // If this snapshot is just the echo of our own recent write, do not revert or re-apply
      if (!isInitialLoad && remoteUpdatedAt <= lastPushedAt) {
        setStatus(snap.metadata.fromCache ? 'offline' : 'synced');
        return;
      }

      const local = pickSyncable(usePaceStore.getState());

      if (isInitialLoad) {
        isInitialLoad = false;
        const hasLocalProgress =
          Object.keys(local.progress).length > 0 ||
          Object.keys(local.bookmarks).length > 0 ||
          Object.keys(local.notes).length > 0 ||
          Object.keys(local.planner).length > 0;

        // One-time merge on initial sign-in if this device had offline solves before logging in
        if (hasLocalProgress && remoteUpdatedAt > 0) {
          const merged: SyncableState = {
            progress: {
              ...cleanProgressMap(remoteData.progress),
              ...local.progress,
            },
            notes: {
              ...cleanNotesMap(remoteData.notes),
              ...local.notes,
            },
            bookmarks: {
              ...cleanBookmarksMap(remoteData.bookmarks),
              ...local.bookmarks,
            },
            solveLog: mergeSolveLog(local.solveLog, remoteData.solveLog),
            planner: {
              ...cleanPlannerMap(remoteData.planner),
              ...local.planner,
            },
            registeredTracks: cleanRegisteredTracks(remoteData.registeredTracks || local.registeredTracks),
          };

          applyingRemoteUpdate = true;
          usePaceStore.setState(merged);
          applyingRemoteUpdate = false;
          pushToFirestore(user.uid);
          return;
        }
      }

      // If the user has a pending local action on this device, let local changes proceed
      if (pushTimer) {
        return;
      }

      // Clean remote state from Firestore
      const cleanRemote: SyncableState = {
        progress: cleanProgressMap(remoteData.progress),
        notes: cleanNotesMap(remoteData.notes),
        bookmarks: cleanBookmarksMap(remoteData.bookmarks),
        solveLog: remoteData.solveLog || {},
        planner: cleanPlannerMap(remoteData.planner),
        registeredTracks: cleanRegisteredTracks(remoteData.registeredTracks),
      };

      const hasDiff = SYNC_FIELDS.some((k) => !mapsEqual(local[k] as any, cleanRemote[k] as any));
      if (hasDiff) {
        applyingRemoteUpdate = true;
        usePaceStore.setState(cleanRemote);
        applyingRemoteUpdate = false;
      }

      setStatus(snap.metadata.fromCache ? 'offline' : 'synced');
    },
    () => setStatus('offline')
  );

  unsubscribeStore = usePaceStore.subscribe((state, prevState) => {
    if (applyingRemoteUpdate) return;
    const changed = SYNC_FIELDS.some((k) => state[k] !== prevState[k]);
    if (changed && currentUid) {
      schedulePush(currentUid);
    }
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
