import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  updateDoc,
  deleteField,
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
  deleted?: boolean;
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
  deleted?: boolean;
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
const DELETED_USERS_KEY = 'pace_admin_deleted_users_v1';
const BANNED_USERS_KEY = 'pace_admin_banned_users_v1';

export function getLocalDeletedUsers(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalDeletedUsers(uids: string[]): void {
  try {
    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(uids));
  } catch {
    // ignore
  }
}

export function getLocalBannedUsers(): string[] {
  try {
    const raw = localStorage.getItem(BANNED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalBannedUsers(uids: string[]): void {
  try {
    localStorage.setItem(BANNED_USERS_KEY, JSON.stringify(uids));
  } catch {
    // ignore
  }
}

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
  const deletedSet = new Set<string>(getLocalDeletedUsers());
  const bannedSet = new Set<string>(getLocalBannedUsers());

  try {
    // 0. Fetch global moderation state from system/moderation
    try {
      const modDoc = await getDoc(doc(db, 'system', 'moderation'));
      if (modDoc.exists()) {
        const modData = modDoc.data();
        if (Array.isArray(modData.deletedUsers)) {
          modData.deletedUsers.forEach((id: string) => deletedSet.add(id));
        }
        if (Array.isArray(modData.bannedUsers)) {
          modData.bannedUsers.forEach((id: string) => bannedSet.add(id));
        }
      }
    } catch {
      // ignore
    }

    // 1. Fetch from leaderboard collection
    const lbSnap = await getDocs(collection(db, 'leaderboard'));
    lbSnap.forEach((d) => {
      const data = d.data();
      // Discover any sync lists from admin's document
      if (Array.isArray(data.deletedUsers)) {
        data.deletedUsers.forEach((id: string) => deletedSet.add(id));
      }
      if (Array.isArray(data.bannedUsers)) {
        data.bannedUsers.forEach((id: string) => bannedSet.add(id));
      }
      if (data.deleted === true) {
        deletedSet.add(d.id);
      }
      if (data.banned === true) {
        bannedSet.add(d.id);
      }
    });

    // Save discovered deleted/banned users back to localStorage for persistence
    setLocalDeletedUsers(Array.from(deletedSet));
    setLocalBannedUsers(Array.from(bannedSet));

    lbSnap.forEach((d) => {
      const data = d.data();
      const uid = data.uid || d.id;
      const updated = Number(data.updatedAt) || Date.now();
      const isDeleted = deletedSet.has(uid) || Boolean(data.deleted);
      const isBanned = bannedSet.has(uid) || Boolean(data.banned);

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
        banned: isBanned,
        deleted: isDeleted,
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

      if (data.deleted === true) {
        deletedSet.add(uid);
      }

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

      const isDeleted = deletedSet.has(uid) || Boolean(data.deleted);
      const isBanned = bannedSet.has(uid) || Boolean(data.banned) || Boolean(existing?.banned);

      if (existing) {
        existing.solvedCount = Math.max(existing.solvedCount, solvedCount);
        existing.registeredTracks = registeredTracks;
        existing.notesCount = notesCount;
        existing.bookmarksCount = bookmarksCount;
        existing.plannerCount = plannerCount;
        existing.rawUserData = data;
        existing.deleted = isDeleted;
        existing.banned = isBanned;
        if (data.email && !existing.email) existing.email = data.email;
        if (data.displayName && (!existing.displayName || existing.displayName === 'Pacer')) {
          existing.displayName = data.displayName;
        }
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
          banned: isBanned,
          deleted: isDeleted,
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
  userDisplayName?: string,
  adminUid?: string
): Promise<{ success: boolean; error?: string }> {
  if (!uid) return { success: false, error: 'Database or UID missing' };

  try {
    // 1. Instantly record in local deleted set
    const currentDeleted = new Set(getLocalDeletedUsers());
    currentDeleted.add(uid);
    const updatedDeletedList = Array.from(currentDeleted);
    setLocalDeletedUsers(updatedDeletedList);

    // 2. Dispatch event for multi-tab reactivity
    try {
      window.dispatchEvent(new CustomEvent('pace-deleted-users-updated', { detail: updatedDeletedList }));
    } catch {
      // ignore
    }

    // 3. Write to leaderboard collection under adminUid (guaranteed write permission!)
    const effectiveAdminUid = adminUid || auth?.currentUser?.uid;
    if (db && effectiveAdminUid) {
      try {
        await setDoc(
          doc(db, 'leaderboard', effectiveAdminUid),
          { deletedUsers: updatedDeletedList },
          { merge: true }
        );
      } catch (err) {
        console.warn('Writing deletedUsers to admin leaderboard doc failed:', err);
      }
    }

    // 4. Write to system/moderation (globally readable by all clients)
    if (db) {
      try {
        await setDoc(
          doc(db, 'system', 'moderation'),
          { deletedUsers: updatedDeletedList, updatedAt: Date.now() },
          { merge: true }
        );
      } catch (err) {
        console.warn('Writing to system/moderation failed:', err);
      }

      try {
        await setDoc(doc(db, 'system', 'deletedUsers'), { list: updatedDeletedList, updatedAt: Date.now() }, { merge: true });
      } catch {
        // ignore
      }
    }

    // 5. Attempt direct Firestore deletion & soft-wipe
    if (db) {
      // Mark deleted: true on target docs first so any listening clients react instantly
      try {
        await setDoc(
          doc(db, 'users', uid),
          {
            deleted: true,
            progress: {},
            solveLog: {},
            notes: {},
            bookmarks: {},
            planner: {},
            tutorChats: {},
            registeredTracks: [],
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch {
        // ignore
      }

      try {
        await setDoc(
          doc(db, 'leaderboard', uid),
          {
            deleted: true,
            displayName: '[Deleted User]',
            solvedCount: 0,
            streak: 0,
            weeklyCount: 0,
            activeDays: 0,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch {
        // ignore
      }

      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (e: any) {
        console.warn('Direct deleteDoc on users failed:', e?.message);
      }

      try {
        await deleteDoc(doc(db, 'leaderboard', uid));
      } catch (e: any) {
        console.warn('Direct deleteDoc on leaderboard failed:', e?.message);
      }
    }

    addAuditLog('DELETE_USER', uid, `Deleted user account "${userDisplayName || uid}" from platform`, 'success');
    return { success: true };
  } catch (err: any) {
    addAuditLog('DELETE_USER', uid, `Error deleting user: ${err?.message || 'Unknown error'}`, 'failed');
    return { success: false, error: err?.message || 'Failed to delete user' };
  }
}

export async function adminRestoreUser(
  uid: string,
  userDisplayName?: string,
  adminUid?: string
): Promise<{ success: boolean; error?: string }> {
  if (!uid) return { success: false, error: 'Database or UID missing' };

  try {
    // 1. Remove from local deleted set
    const currentDeleted = new Set(getLocalDeletedUsers());
    currentDeleted.delete(uid);
    const updatedDeletedList = Array.from(currentDeleted);
    setLocalDeletedUsers(updatedDeletedList);

    // 2. Dispatch event
    try {
      window.dispatchEvent(new CustomEvent('pace-deleted-users-updated', { detail: updatedDeletedList }));
    } catch {
      // ignore
    }

    // 3. Write to leaderboard collection under adminUid
    const effectiveAdminUid = adminUid || auth?.currentUser?.uid;
    if (db && effectiveAdminUid) {
      try {
        await setDoc(
          doc(db, 'leaderboard', effectiveAdminUid),
          { deletedUsers: updatedDeletedList },
          { merge: true }
        );
      } catch (err) {
        console.warn('Updating deletedUsers on admin leaderboard doc failed:', err);
      }
    }

    // 4. Update system/moderation and system/deletedUsers
    if (db) {
      try {
        await setDoc(
          doc(db, 'system', 'moderation'),
          { deletedUsers: updatedDeletedList, updatedAt: Date.now() },
          { merge: true }
        );
      } catch (err) {
        console.warn('Updating system/moderation failed:', err);
      }
      try {
        await setDoc(doc(db, 'system', 'deletedUsers'), { list: updatedDeletedList, updatedAt: Date.now() }, { merge: true });
      } catch {
        // ignore
      }
      try {
        await setDoc(doc(db, 'leaderboard', uid), { deleted: false, updatedAt: Date.now() }, { merge: true });
      } catch {
        // ignore
      }
      try {
        await setDoc(doc(db, 'users', uid), { deleted: false, updatedAt: Date.now() }, { merge: true });
      } catch {
        // ignore
      }
    }

    addAuditLog('RESTORE_USER', uid, `Restored user account "${userDisplayName || uid}" to active platform status`, 'success');
    return { success: true };
  } catch (err: any) {
    addAuditLog('RESTORE_USER', uid, `Error restoring user: ${err?.message || 'Unknown error'}`, 'failed');
    return { success: false, error: err?.message || 'Failed to restore user' };
  }
}

export async function adminToggleBanUser(
  uid: string,
  banned: boolean,
  userDisplayName?: string,
  adminUid?: string
): Promise<{ success: boolean; error?: string }> {
  if (!db || !uid) return { success: false, error: 'Database or UID missing' };

  try {
    const currentBanned = new Set(getLocalBannedUsers());
    if (banned) currentBanned.add(uid);
    else currentBanned.delete(uid);
    const updatedBannedList = Array.from(currentBanned);
    setLocalBannedUsers(updatedBannedList);

    const effectiveAdminUid = adminUid || auth?.currentUser?.uid;
    if (db && effectiveAdminUid) {
      try {
        await setDoc(
          doc(db, 'leaderboard', effectiveAdminUid),
          { bannedUsers: updatedBannedList },
          { merge: true }
        );
      } catch {
        // ignore
      }
    }

    if (db) {
      try {
        await setDoc(
          doc(db, 'system', 'moderation'),
          { bannedUsers: updatedBannedList, updatedAt: Date.now() },
          { merge: true }
        );
      } catch (err) {
        console.warn('Updating system/moderation failed:', err);
      }
      try {
        await setDoc(doc(db, 'system', 'bannedUsers'), { list: updatedBannedList, updatedAt: Date.now() }, { merge: true });
      } catch {
        // ignore
      }
      try {
        await setDoc(doc(db, 'users', uid), { banned, updatedAt: Date.now() }, { merge: true });
      } catch {
        // ignore
      }
      try {
        await setDoc(doc(db, 'leaderboard', uid), { banned, updatedAt: Date.now() }, { merge: true });
      } catch {
        // ignore
      }
    }

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
        tutorChats: {},
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
    if (parsed && typeof parsed === 'object') {
      // Must be explicitly active, non-empty, and not marked deleted
      if (
        parsed.active === true &&
        typeof parsed.message === 'string' &&
        parsed.message.trim() &&
        !parsed.deleted
      ) {
        return parsed as BroadcastAnnouncement;
      }
      // Purge invalid, empty, or deleted cached announcement immediately
      try {
        localStorage.removeItem(BROADCAST_STORAGE_KEY);
      } catch {
        // ignore
      }
      return null;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function fetchBroadcastAnnouncement(): Promise<BroadcastAnnouncement | null> {
  const firestore = db;
  if (!firestore) {
    const cached = getCachedBroadcast();
    return cached && cached.active && cached.message && !cached.deleted ? cached : null;
  }

  try {
    const snap = await getDoc(doc(firestore, 'system', 'announcement'));
    if (snap.exists()) {
      const data = snap.data() as (BroadcastAnnouncement & { deleted?: boolean });
      if (
        data &&
        data.active === true &&
        typeof data.message === 'string' &&
        data.message.trim() &&
        !data.deleted
      ) {
        return data;
      }
      // Inactive, empty, or marked deleted -> no active announcement
      return null;
    }
    // Document does not exist in Firestore -> no active announcement
    return null;
  } catch (err) {
    console.warn('fetchBroadcastAnnouncement error:', err);
    return null;
  }
}

export async function updateBroadcastAnnouncement(
  announcement: BroadcastAnnouncement,
  adminUid?: string
): Promise<{ success: boolean; error?: string }> {
  const isActive = Boolean(announcement.active && announcement.message && announcement.message.trim());
  const payload: BroadcastAnnouncement & { deleted: boolean } = {
    ...announcement,
    active: isActive,
    deleted: false,
    updatedAt: Date.now(),
    updatedBy: announcement.updatedBy || ADMIN_EMAIL,
  };

  let writeSucceeded = false;
  let lastError: string | undefined;

  // 1. Local storage: store only if active, otherwise remove immediately
  if (isActive) {
    try {
      localStorage.setItem(BROADCAST_STORAGE_KEY, JSON.stringify(payload));
      writeSucceeded = true;
    } catch {
      // ignore
    }
  } else {
    try {
      localStorage.removeItem(BROADCAST_STORAGE_KEY);
      sessionStorage.removeItem('pace_dismissed_broadcast');
      writeSucceeded = true;
    } catch {
      // ignore
    }
  }

  // 2. Write to system/announcement as the single platform source of truth
  const firestore = db;
  if (firestore) {
    try {
      await setDoc(doc(firestore, 'system', 'announcement'), payload);
      writeSucceeded = true;
    } catch (err: any) {
      console.warn('Writing to system/announcement failed:', err);
      lastError = err?.message;
    }

    // Clean up legacy leaderboard documents so no zombie announcement lingers
    try {
      const uid = adminUid || auth?.currentUser?.uid;
      if (uid) {
        await setDoc(
          doc(firestore, 'leaderboard', uid),
          { systemAnnouncement: null },
          { merge: true }
        );
      }
      if (!isActive) {
        const lbSnap = await getDocs(collection(firestore, 'leaderboard'));
        const clearPromises: Promise<any>[] = [];
        lbSnap.forEach((d) => {
          if (d.data().systemAnnouncement) {
            clearPromises.push(
              updateDoc(doc(firestore, 'leaderboard', d.id), {
                systemAnnouncement: deleteField(),
              }).catch(() => {
                return setDoc(doc(firestore, 'leaderboard', d.id), { systemAnnouncement: null }, { merge: true });
              })
            );
          }
        });
        await Promise.all(clearPromises);
      }
    } catch {
      // ignore
    }
  }

  // 3. Broadcast to all active listeners in this tab and other tabs
  const broadcastToEmit = isActive ? payload : null;
  notifyBroadcastSubscribers(broadcastToEmit);
  try {
    window.dispatchEvent(new CustomEvent('pace-broadcast-updated', { detail: broadcastToEmit }));
  } catch {
    // ignore
  }

  addAuditLog(
    payload.active ? 'PUBLISH_BROADCAST' : 'PAUSE_BROADCAST',
    'system/announcement',
    `Announcement ${payload.active ? 'published' : 'paused'}: "${(payload.message || '').slice(0, 30)}..."`,
    'success'
  );

  return { success: writeSucceeded, error: writeSucceeded ? undefined : lastError };
}

export async function deleteBroadcastAnnouncement(
  adminUid?: string
): Promise<{ success: boolean; error?: string }> {
  let writeSucceeded = false;
  let lastError: string | undefined;

  // 1. Clear local storage & session storage on current device
  try {
    localStorage.removeItem(BROADCAST_STORAGE_KEY);
    sessionStorage.removeItem('pace_dismissed_broadcast');
    writeSucceeded = true;
  } catch {
    // ignore
  }

  // 2. Write an authoritative deleted tombstone to system/announcement so all clients receive instant real-time removal
  const firestore = db;
  if (firestore) {
    const tombstonePayload = {
      active: false,
      message: '',
      type: 'info' as const,
      link: '',
      linkText: '',
      deleted: true,
      updatedAt: Date.now(),
      updatedBy: ADMIN_EMAIL,
    };

    try {
      await setDoc(doc(firestore, 'system', 'announcement'), tombstonePayload);
      writeSucceeded = true;
    } catch (err: any) {
      console.warn('Failed setting tombstone on system/announcement:', err);
      lastError = err?.message;
    }

    // 3. Clear any legacy systemAnnouncement fields from leaderboard collection
    try {
      const uid = adminUid || auth?.currentUser?.uid;
      if (uid) {
        await setDoc(
          doc(firestore, 'leaderboard', uid),
          { systemAnnouncement: null },
          { merge: true }
        );
      }
      const lbSnap = await getDocs(collection(firestore, 'leaderboard'));
      const clearPromises: Promise<any>[] = [];
      lbSnap.forEach((d) => {
        const data = d.data();
        if (data.systemAnnouncement) {
          clearPromises.push(
            updateDoc(doc(firestore, 'leaderboard', d.id), {
              systemAnnouncement: deleteField(),
            }).catch(() => {
              return setDoc(doc(firestore, 'leaderboard', d.id), { systemAnnouncement: null }, { merge: true });
            })
          );
        }
      });
      await Promise.all(clearPromises);
    } catch (err) {
      console.warn('Error clearing legacy systemAnnouncement from leaderboard collection:', err);
    }
  }

  // 4. Notify all listeners in this window and other tabs immediately
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

  return { success: writeSucceeded, error: writeSucceeded ? undefined : lastError };
}

export function subscribeBroadcast(
  callback: (announcement: BroadcastAnnouncement | null) => void
): () => void {
  broadcastListeners.add(callback);

  // 1. Initial cached value (only if valid, active, and not deleted)
  const cached = getCachedBroadcast();
  if (cached) {
    callback(cached);
  } else {
    callback(null);
  }

  const clearBroadcast = () => {
    try {
      localStorage.removeItem(BROADCAST_STORAGE_KEY);
      sessionStorage.removeItem('pace_dismissed_broadcast');
    } catch {
      // ignore
    }
    callback(null);
  };

  const applyBroadcast = (announcement: BroadcastAnnouncement) => {
    try {
      localStorage.setItem(BROADCAST_STORAGE_KEY, JSON.stringify(announcement));
    } catch {
      // ignore
    }
    callback(announcement);
  };

  // 2. Listen for local events across tabs / windows
  const handleCustomEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail as (BroadcastAnnouncement & { deleted?: boolean }) | null;
    if (
      detail &&
      detail.active === true &&
      typeof detail.message === 'string' &&
      detail.message.trim() &&
      !detail.deleted
    ) {
      applyBroadcast(detail);
    } else {
      clearBroadcast();
    }
  };
  window.addEventListener('pace-broadcast-updated', handleCustomEvent);

  const handleStorage = (e: StorageEvent) => {
    if (e.key === BROADCAST_STORAGE_KEY) {
      if (!e.newValue) {
        callback(null);
        return;
      }
      try {
        const val = JSON.parse(e.newValue);
        if (
          val &&
          val.active === true &&
          typeof val.message === 'string' &&
          val.message.trim() &&
          !val.deleted
        ) {
          callback(val);
        } else {
          clearBroadcast();
        }
      } catch {
        clearBroadcast();
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  const unsubs: (() => void)[] = [];

  // 3. Real-Time Firestore Listener on the single source of truth: system/announcement
  const firestore = db;
  if (firestore) {
    try {
      const unsubSystem = onSnapshot(
        doc(firestore, 'system', 'announcement'),
        (snap) => {
          if (!snap.exists()) {
            // Document does not exist -> announcement permanently removed!
            clearBroadcast();
            return;
          }

          const data = snap.data() as (BroadcastAnnouncement & { deleted?: boolean });
          if (
            data &&
            data.active === true &&
            typeof data.message === 'string' &&
            data.message.trim() &&
            !data.deleted
          ) {
            applyBroadcast(data);
          } else {
            // Document exists but is paused, empty, inactive, or marked deleted -> clear it immediately!
            clearBroadcast();
          }
        },
        (err) => {
          console.warn('System announcement listener warning:', err);
        }
      );
      unsubs.push(unsubSystem);
    } catch (err) {
      console.warn('Failed subscribing to system/announcement:', err);
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
