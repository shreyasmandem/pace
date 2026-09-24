import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';

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

export function getAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addAuditLog(action: string, target: string, details: string, status: 'success' | 'failed' | 'warning' = 'success'): void {
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
      const plannerCount = Object.values(planner).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0);

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

export async function adminDeleteUser(uid: string, userDisplayName?: string): Promise<{ success: boolean; error?: string }> {
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
    await setDoc(doc(db, 'users', uid), {
      displayName: updates.displayName,
      email: updates.email,
      updatedAt: Date.now(),
    }, { merge: true });

    addAuditLog('UPDATE_USER', uid, `Updated profile/stats for user ${updates.displayName || uid}`, 'success');
    return { success: true };
  } catch (err: any) {
    addAuditLog('UPDATE_USER', uid, `Failed to update user: ${err?.message}`, 'failed');
    return { success: false, error: err?.message || 'Failed to update user' };
  }
}

export async function adminResetUserProgress(uid: string, userDisplayName?: string): Promise<{ success: boolean; error?: string }> {
  if (!db || !uid) return { success: false, error: 'Database or UID missing' };

  try {
    await setDoc(doc(db, 'users', uid), {
      progress: {},
      solveLog: {},
      planner: {},
      updatedAt: Date.now(),
    }, { merge: true });

    await setDoc(doc(db, 'leaderboard', uid), {
      solvedCount: 0,
      streak: 0,
      weeklyCount: 0,
      activeDays: 0,
      updatedAt: Date.now(),
    }, { merge: true });

    addAuditLog('RESET_PROGRESS', uid, `Reset all progress, streaks, and planner for ${userDisplayName || uid}`, 'warning');
    return { success: true };
  } catch (err: any) {
    addAuditLog('RESET_PROGRESS', uid, `Failed to reset progress: ${err?.message}`, 'failed');
    return { success: false, error: err?.message || 'Failed to reset progress' };
  }
}

export async function adminToggleBanUser(uid: string, banned: boolean, userDisplayName?: string): Promise<{ success: boolean; error?: string }> {
  if (!db || !uid) return { success: false, error: 'Database or UID missing' };

  try {
    await setDoc(doc(db, 'users', uid), { banned, updatedAt: Date.now() }, { merge: true });
    await setDoc(doc(db, 'leaderboard', uid), { banned, updatedAt: Date.now() }, { merge: true });

    addAuditLog(banned ? 'BAN_USER' : 'UNBAN_USER', uid, `${banned ? 'Suspended' : 'Unbanned'} user ${userDisplayName || uid}`, banned ? 'warning' : 'success');
    return { success: true };
  } catch (err: any) {
    addAuditLog('BAN_TOGGLE', uid, `Failed to toggle ban: ${err?.message}`, 'failed');
    return { success: false, error: err?.message || 'Failed to toggle ban' };
  }
}

export async function fetchBroadcastAnnouncement(): Promise<BroadcastAnnouncement | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'system', 'announcement'));
    if (snap.exists()) {
      return snap.data() as BroadcastAnnouncement;
    }
  } catch (err) {
    console.warn('Failed to fetch broadcast announcement:', err);
  }
  return null;
}

export async function updateBroadcastAnnouncement(announcement: BroadcastAnnouncement): Promise<boolean> {
  if (!db) return false;
  try {
    await setDoc(doc(db, 'system', 'announcement'), {
      ...announcement,
      updatedAt: Date.now(),
    }, { merge: true });
    addAuditLog('UPDATE_BROADCAST', 'system/announcement', `Announcement ${announcement.active ? 'published' : 'deactivated'}: "${announcement.message.slice(0, 30)}..."`, 'success');
    return true;
  } catch (err) {
    console.warn('Failed to update broadcast:', err);
    return false;
  }
}

export function subscribeBroadcast(callback: (announcement: BroadcastAnnouncement | null) => void): () => void {
  if (!db) return () => {};
  try {
    return onSnapshot(doc(db, 'system', 'announcement'), (snap) => {
      if (snap.exists()) {
        callback(snap.data() as BroadcastAnnouncement);
      } else {
        callback(null);
      }
    }, () => {
      callback(null);
    });
  } catch {
    return () => {};
  }
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
