import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from './firebase';

export const ADMIN_EMAIL = 'shreyas0381@gmail.com';

export function isPaceAdmin(user: { email?: string | null; displayName?: string | null } | null): boolean {
  if (!user || !user.email) return false;
  return user.email.toLowerCase().trim() === ADMIN_EMAIL;
}

export interface AdminUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  solvedCount: number;
  streak: number;
  weeklyCount: number;
  activeDays: number;
  registeredTracks: string[];
  banned?: boolean;
  notesCount?: number;
  bookmarksCount?: number;
  plannerCount?: number;
  updatedAt: number;
  lastActiveFormatted: string;
  rawUserData?: Record<string, any>;
  rawLeaderboardData?: Record<string, any>;
}

export interface BroadcastAnnouncement {
  id?: string;
  active: boolean;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success';
  link?: string;
  linkText?: string;
  updatedAt: number;
  updatedBy: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: string;
  target: string;
  details: string;
  status: 'success' | 'failed' | 'warning';
}

const AUDIT_LOG_KEY = 'pace_admin_audit_log_v1';
const BROADCAST_STORAGE_KEY = 'pace_global_broadcast';

export function getAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addAuditLog(
  action: string,
  target: string,
  details: string,
  status: 'success' | 'failed' | 'warning' = 'success'
): void {
  try {
    const current = getAuditLogs();
    const entry: AuditLogEntry = {
      id: 'audit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      action,
      target,
      details,
      status,
    };
    const updated = [entry, ...current.slice(0, 199)]; // Keep latest 200
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function clearAuditLogs(): void {
  try {
    localStorage.removeItem(AUDIT_LOG_KEY);
  } catch {
    // ignore
  }
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  if (!db) return [];

  const userMap = new Map<string, AdminUser>();

  try {
    // 1. Fetch from leaderboard collection
    const lbSnap = await getDocs(collection(db, 'leaderboard'));
    lbSnap.forEach((d) => {
      const data = d.data();
      const uid = data.uid || d.id;
      const updated = Number(data.updatedAt) || Date.now();
      userMap.set(uid, {
        uid,
        displayName: data.displayName || 'Pacer',
        email: data.email || '',
        photoURL: data.photoURL || '',
        solvedCount: Number(data.solvedCount) || 0,
        streak: Number(data.streak) || 0,
        weeklyCount: Number(data.weeklyCount) || 0,
        activeDays: Number(data.activeDays) || 0,
        registeredTracks: [],
        banned: Boolean(data.banned),
        updatedAt: updated,
        lastActiveFormatted: new Date(updated).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        rawLeaderboardData: data,
      });
    });
  } catch (err) {
    console.warn('Admin fetch leaderboard failed:', err);
  }

  try {
    // 2. Fetch from users collection
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.forEach((d) => {
      const data = d.data();
      const uid = d.id;
      const existing = userMap.get(uid);

      const progress = data.progress || {};
      const notes = data.notes || {};
      const bookmarks = data.bookmarks || {};
      const planner = data.planner || {};
      const registeredTracks = Array.isArray(data.registeredTracks) ? data.registeredTracks : [];
      const updated = Number(data.updatedAt) || existing?.updatedAt || Date.now();

      const solvedCount = Object.keys(progress).length;
      const notesCount = Object.keys(notes).length;
      const bookmarksCount = Object.keys(bookmarks).length;
      const plannerCount = Object.values(planner).reduce(
        (acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0),
        0
      );

      if (existing) {
        existing.solvedCount = Math.max(existing.solvedCount, solvedCount);
        existing.registeredTracks = registeredTracks;
        existing.notesCount = notesCount;
        existing.bookmarksCount = bookmarksCount;
        existing.plannerCount = plannerCount;
        existing.rawUserData = data;
        if (data.email && !existing.email) existing.email = data.email;
        if (data.displayName && (!existing.displayName || existing.displayName === 'Pacer')) {
          existing.displayName = data.displayName;
        }
        if (data.banned !== undefined) existing.banned = Boolean(data.banned);
      } else {
        userMap.set(uid, {
          uid,
          displayName: data.displayName || (data.email ? data.email.split('@')[0] : 'Pacer'),
          email: data.email || '',
          photoURL: data.photoURL || '',
          solvedCount,
          streak: 0,
          weeklyCount: 0,
          activeDays: Object.keys(data.solveLog || {}).length,
          registeredTracks,
          notesCount,
          bookmarksCount,
          plannerCount,
          banned: Boolean(data.banned),
          updatedAt: updated,
          lastActiveFormatted: new Date(updated).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          rawUserData: data,
        });
      }
    });
  } catch (err) {
    console.warn('Admin fetch users failed:', err);
  }

  return Array.from(userMap.values()).sort((a, b) => b.solvedCount - a.solvedCount);
}

export async function adminDeleteUser(
  uid: string,
  userDisplayName?: string
): Promise<{ success: boolean; error?: string }> {
  if (!db || !uid) return { success: false, error: 'Database or UID missing' };

  try {
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (e: any) {
      console.warn('Failed deleting users collection doc:', e);
    }

    try {
      await deleteDoc(doc(db, 'leaderboard', uid));
    } catch (e: any) {
      console.warn('Failed deleting leaderboard collection doc:', e);
    }

    addAuditLog('DELETE_USER', uid, `Deleted user account "${userDisplayName || uid}" from platform`, 'success');
    return { success: true };
  } catch (err: any) {
    addAuditLog('DELETE_USER', uid, `Error deleting user: ${err?.message || 'Unknown error'}`, 'failed');
    return { success: false, error: err?.message || 'Failed to delete user' };
  }
}

export async function adminUpdateUser(
  uid: string,
  updates: {
    displayName?: string;
    email?: string;
    solvedCount?: number;
    streak?: number;
    weeklyCount?: number;
    activeDays?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!db || !uid) return { success: false, error: 'Database or UID missing' };

  try {
    const payload: Record<string, any> = {
      ...updates,
      updatedAt: Date.now(),
    };

    await setDoc(doc(db, 'leaderboard', uid), payload, { merge: true });
    await setDoc(
      doc(db, 'users', uid),
      {
        displayName: updates.displayName,
        email: updates.email,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    addAuditLog('UPDATE_USER', uid, `Updated profile/stats for user ${updates.displayName || uid}`, 'success');
    return { success: true };
  } catch (err: any) {
    addAuditLog('UPDATE_USER', uid, `Failed to update user: ${err?.message}`, 'failed');
    return { success: false, error: err?.message || 'Failed to update user' };
  }
}

export async function adminResetUserProgress(
  uid: string,
  userDisplayName?: string
): Promise<{ success: boolean; error?: string }> {
  if (!db || !uid) return { success: false, error: 'Database or UID missing' };

  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        progress: {},
        solveLog: {},
        planner: {},
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    await setDoc(
      doc(db, 'leaderboard', uid),
      {
        solvedCount: 0,
        streak: 0,
        weeklyCount: 0,
        activeDays: 0,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    addAuditLog('RESET_PROGRESS', uid, `Reset all progress, streaks, and planner for ${userDisplayName || uid}`, 'warning');
    return { success: true };
  } catch (err: any) {
    addAuditLog('RESET_PROGRESS', uid, `Failed to reset progress: ${err?.message}`, 'failed');
    return { success: false, error: err?.message || 'Failed to reset progress' };
  }
}

export async function adminToggleBanUser(
  uid: string,
  banned: boolean,
  userDisplayName?: string
): Promise<{ success: boolean; error?: string }> {
  if (!db || !uid) return { success: false, error: 'Database or UID missing' };

  try {
    await setDoc(doc(db, 'users', uid), { banned, updatedAt: Date.now() }, { merge: true });
    await setDoc(doc(db, 'leaderboard', uid), { banned, updatedAt: Date.now() }, { merge: true });

    addAuditLog(
      banned ? 'BAN_USER' : 'UNBAN_USER',
      uid,
      `${banned ? 'Suspended' : 'Unbanned'} user ${userDisplayName || uid}`,
      banned ? 'warning' : 'success'
    );
    return { success: true };
  } catch (err: any) {
    addAuditLog('BAN_TOGGLE', uid, `Failed to toggle ban: ${err?.message}`, 'failed');
    return { success: false, error: err?.message || 'Failed to toggle ban' };
  }
}

// ============================================================================
// BROADCAST ANNOUNCEMENTS (DUAL-CHANNEL PERSISTENCE + DELETION SUPPORT)
// ============================================================================

const broadcastListeners = new Set<(announcement: BroadcastAnnouncement | null) => void>();

function notifyBroadcastSubscribers(announcement: BroadcastAnnouncement | null) {
  broadcastListeners.forEach((fn) => {
    try {
      fn(announcement);
    } catch {
      // ignore
    }
  });
}

export function getCachedBroadcast(): BroadcastAnnouncement | null {
  try {
    const raw = localStorage.getItem(BROADCAST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as BroadcastAnnouncement;
  } catch {
    // ignore
  }
  return null;
}

export async function fetchBroadcastAnnouncement(): Promise<BroadcastAnnouncement | null> {
  let result: BroadcastAnnouncement | null = null;

  if (db) {
    // 1. Try reading from system/announcement
    try {
      const snap = await getDoc(doc(db, 'system', 'announcement'));
      if (snap.exists()) {
        const data = snap.data() as BroadcastAnnouncement;
        if (data && data.message !== undefined) {
          result = data;
        }
      }
    } catch {
      // Permission or collection error
    }

    // 2. If not found, check leaderboard collection
    if (!result || !result.message) {
      try {
        const lbSnap = await getDocs(collection(db, 'leaderboard'));
        lbSnap.forEach((d) => {
          const data = d.data();
          if (data.systemAnnouncement && data.systemAnnouncement.updatedAt) {
            if (!result || data.systemAnnouncement.updatedAt > (result.updatedAt || 0)) {
              result = data.systemAnnouncement as BroadcastAnnouncement;
            }
          }
        });
      } catch {
        // ignore
      }
    }
  }

  // 3. Fallback to localStorage cache
  if (!result) {
    result = getCachedBroadcast();
  }

  return result;
}

export async function updateBroadcastAnnouncement(
  announcement: BroadcastAnnouncement,
  adminUid?: string
): Promise<{ success: boolean; error?: string }> {
  const payload: BroadcastAnnouncement = {
    ...announcement,
    updatedAt: Date.now(),
    updatedBy: announcement.updatedBy || ADMIN_EMAIL,
  };

  let writeSucceeded = false;
  let lastError: string | undefined;

  // 1. Write to local storage for instant sync across tabs & session
  try {
    localStorage.setItem(BROADCAST_STORAGE_KEY, JSON.stringify(payload));
    writeSucceeded = true;
  } catch {
    // ignore
  }

  // 2. Write to leaderboard collection under adminUid (guaranteed by live Firestore rules!)
  const uid = adminUid || auth?.currentUser?.uid;
  if (db && uid) {
    try {
      await setDoc(
        doc(db, 'leaderboard', uid),
        { systemAnnouncement: payload },
        { merge: true }
      );
      writeSucceeded = true;
    } catch (err: any) {
      console.warn('Writing announcement to leaderboard doc failed:', err);
      lastError = err?.message;
    }
  }

  // 3. Write to system/announcement (for when /system rules are enabled)
  if (db) {
    try {
      await setDoc(doc(db, 'system', 'announcement'), payload, { merge: true });
      writeSucceeded = true;
    } catch (err: any) {
      console.warn('Writing to system/announcement failed (likely rules):', err);
      if (!lastError) lastError = err?.message;
    }
  }

  // 4. Broadcast to all active listeners in this window and other tabs
  notifyBroadcastSubscribers(payload);
  try {
    window.dispatchEvent(new CustomEvent('pace-broadcast-updated', { detail: payload }));
  } catch {
    // ignore
  }

  addAuditLog(
    payload.active ? 'PUBLISH_BROADCAST' : 'PAUSE_BROADCAST',
    'system/announcement',
    `Announcement ${payload.active ? 'published' : 'paused'}: "${payload.message.slice(0, 30)}..."`,
    'success'
  );

  return { success: writeSucceeded, error: writeSucceeded ? undefined : lastError };
}

export async function deleteBroadcastAnnouncement(
  adminUid?: string
): Promise<{ success: boolean; error?: string }> {
  let writeSucceeded = false;

  // 1. Clear local storage
  try {
    localStorage.removeItem(BROADCAST_STORAGE_KEY);
    sessionStorage.removeItem('pace_dismissed_broadcast');
    writeSucceeded = true;
  } catch {
    // ignore
  }

  // 2. Clear from leaderboard doc
  const uid = adminUid || auth?.currentUser?.uid;
  if (db && uid) {
    try {
      await setDoc(
        doc(db, 'leaderboard', uid),
        { systemAnnouncement: null },
        { merge: true }
      );
      writeSucceeded = true;
    } catch (err) {
      console.warn('Failed clearing announcement from leaderboard:', err);
    }
  }

  // 3. Clear from system/announcement
  if (db) {
    try {
      await deleteDoc(doc(db, 'system', 'announcement'));
      writeSucceeded = true;
    } catch {
      try {
        await setDoc(doc(db, 'system', 'announcement'), {
          active: false,
          message: '',
          updatedAt: Date.now(),
        });
        writeSucceeded = true;
      } catch {
        // ignore
      }
    }
  }

  // 4. Notify all listeners
  notifyBroadcastSubscribers(null);
  try {
    window.dispatchEvent(new CustomEvent('pace-broadcast-updated', { detail: null }));
  } catch {
    // ignore
  }

  addAuditLog(
    'DELETE_BROADCAST',
    'system/announcement',
    'Permanently deleted platform broadcast announcement',
    'warning'
  );

  return { success: writeSucceeded };
}

export function subscribeBroadcast(
  callback: (announcement: BroadcastAnnouncement | null) => void
): () => void {
  broadcastListeners.add(callback);

  // Initial call with cached value
  const cached = getCachedBroadcast();
  if (cached) {
    callback(cached);
  }

  // Listen for local events across tabs / windows
  const handleCustomEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    callback(detail || null);
  };
  window.addEventListener('pace-broadcast-updated', handleCustomEvent);

  const handleStorage = (e: StorageEvent) => {
    if (e.key === BROADCAST_STORAGE_KEY) {
      try {
        const val = e.newValue ? JSON.parse(e.newValue) : null;
        callback(val);
      } catch {
        callback(null);
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  const unsubs: (() => void)[] = [];

  // Firestore listeners
  if (db) {
    // A. Listen to system/announcement
    try {
      const unsubSystem = onSnapshot(
        doc(db, 'system', 'announcement'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as BroadcastAnnouncement;
            if (data && data.message) {
              localStorage.setItem(BROADCAST_STORAGE_KEY, JSON.stringify(data));
              callback(data);
              return;
            }
          }
          if (!snap.exists()) {
            // Check leaderboard fallback
            fetchBroadcastAnnouncement().then((ann) => {
              if (!ann || !ann.message) {
                localStorage.removeItem(BROADCAST_STORAGE_KEY);
                callback(null);
              } else {
                callback(ann);
              }
            });
          }
        },
        () => {
          // Fallback if system/announcement has rules error
        }
      );
      unsubs.push(unsubSystem);
    } catch {
      // ignore
    }

    // B. Also listen to leaderboard collection (publicly readable to everyone!)
    try {
      const unsubLb = onSnapshot(
        collection(db, 'leaderboard'),
        (snap) => {
          let foundAnnouncement: BroadcastAnnouncement | null = null;
          snap.forEach((d) => {
            const data = d.data();
            if (data.systemAnnouncement && data.systemAnnouncement.updatedAt) {
              if (!foundAnnouncement || data.systemAnnouncement.updatedAt > foundAnnouncement.updatedAt) {
                foundAnnouncement = data.systemAnnouncement as BroadcastAnnouncement;
              }
            }
          });

          if (foundAnnouncement) {
            localStorage.setItem(BROADCAST_STORAGE_KEY, JSON.stringify(foundAnnouncement));
            callback(foundAnnouncement);
          } else {
            // Only clear if no cached broadcast exists
            if (!localStorage.getItem(BROADCAST_STORAGE_KEY)) {
              callback(null);
            }
          }
        },
        () => {
          // ignore
        }
      );
      unsubs.push(unsubLb);
    } catch {
      // ignore
    }
  }

  return () => {
    broadcastListeners.delete(callback);
    window.removeEventListener('pace-broadcast-updated', handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
    unsubs.forEach((u) => {
      try {
        u();
      } catch {
        // ignore
      }
    });
  };
}

export async function exportPlatformSnapshot(): Promise<string> {
  const users = await fetchAdminUsers();
  const broadcast = await fetchBroadcastAnnouncement();
  const auditLogs = getAuditLogs();

  const snapshot = {
    exportedAt: new Date().toISOString(),
    platform: 'Pace - DSA Prep Tracker',
    admin: ADMIN_EMAIL,
    totalUsers: users.length,
    totalSolves: users.reduce((acc, u) => acc + (u.solvedCount || 0), 0),
    broadcast,
    auditLogs,
    users,
  };

  return JSON.stringify(snapshot, null, 2);
}
