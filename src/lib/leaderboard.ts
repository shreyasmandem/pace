import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL?: string;
  solvedCount: number;
  streak: number;
  weeklyCount: number;
  activeDays: number;
  updatedAt: number;
  rank?: number;
  isCurrentUser?: boolean;
}

export type TierLevel =
  | 'Grandmaster'
  | 'Master'
  | 'Diamond'
  | 'Gold'
  | 'Silver'
  | 'Bronze'
  | 'Novice';

export function calculateTier(solvedCount: number): {
  tier: TierLevel;
  color: string;
  bg: string;
} {
  if (solvedCount >= 450) {
    return {
      tier: 'Grandmaster',
      color: '#f0596b',
      bg: 'rgba(240, 89, 107, 0.15)',
    };
  }
  if (solvedCount >= 250) {
    return {
      tier: 'Master',
      color: '#b695f0',
      bg: 'rgba(182, 149, 240, 0.15)',
    };
  }
  if (solvedCount >= 120) {
    return {
      tier: 'Diamond',
      color: '#5fc4e8',
      bg: 'rgba(95, 196, 232, 0.15)',
    };
  }
  if (solvedCount >= 50) {
    return {
      tier: 'Gold',
      color: '#f0b429',
      bg: 'rgba(240, 180, 41, 0.15)',
    };
  }
  if (solvedCount >= 15) {
    return {
      tier: 'Silver',
      color: '#cbd5e1',
      bg: 'rgba(203, 213, 225, 0.15)',
    };
  }
  if (solvedCount >= 1) {
    return {
      tier: 'Bronze',
      color: '#ff7a29',
      bg: 'rgba(255, 122, 41, 0.15)',
    };
  }
  return {
    tier: 'Novice',
    color: '#6a6b76',
    bg: 'rgba(106, 107, 118, 0.15)',
  };
}

export function calculateWeeklySolves(
  solveLog: Record<string, number> = {}
): number {
  let count = 0;
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    count += solveLog[iso] || 0;
  }
  return count;
}

export function longestStreak(solveLog: Record<string, number> = {}): number {
  const activeDays = Object.keys(solveLog)
    .filter((k) => (solveLog[k] || 0) > 0)
    .sort();

  if (activeDays.length === 0) return 0;

  let maxStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < activeDays.length; i++) {
    const prev = new Date(activeDays[i - 1]);
    const curr = new Date(activeDays[i]);
    const diffTime = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

    if (diffDays === 1) {
      currentRun += 1;
      if (currentRun > maxStreak) maxStreak = currentRun;
    } else if (diffDays > 1) {
      currentRun = 1;
    }
  }

  return maxStreak;
}

export interface CurrentLeaderboardUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  solvedCount: number;
  streak: number;
  weeklyCount: number;
  activeDays: number;
}

export interface LeaderboardError {
  code: string;
  message: string;
}

export async function publishToLeaderboard(
  uid: string,
  user: User | null,
  stats: {
    solvedCount: number;
    streak: number;
    weeklyCount: number;
    activeDays: number;
  }
): Promise<{ success: boolean; error?: LeaderboardError }> {
  if (!db || !uid) return { success: false };

  const displayName =
    user?.displayName ||
    (user?.email ? user.email.split('@')[0] : 'Pacer');

  const photoURL = user?.photoURL || '';

  try {
    await setDoc(
      doc(db, 'leaderboard', uid),
      {
        uid,
        displayName,
        photoURL,
        email: user?.email || '',
        solvedCount: Number(stats.solvedCount) || 0,
        streak: Number(stats.streak) || 0,
        weeklyCount: Number(stats.weeklyCount) || 0,
        activeDays: Number(stats.activeDays) || 0,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return { success: true };
  } catch (err: any) {
    console.warn('Could not sync to leaderboard collection:', err);
    return {
      success: false,
      error: { code: err?.code || 'unknown', message: err?.message || 'Failed to publish' },
    };
  }
}

export async function updateLeaderboardDisplayName(
  uid: string,
  displayName: string
): Promise<boolean> {
  if (!db || !uid) return false;
  try {
    await setDoc(
      doc(db, 'leaderboard', uid),
      {
        displayName,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    try {
      await setDoc(
        doc(db, 'users', uid),
        {
          displayName,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch {
      // ignore
    }
    return true;
  } catch (err: any) {
    console.warn('Could not update display name in leaderboard collection:', err);
    return false;
  }
}

function processLeaderboardSnap(
  snapDocs: { id: string; data: () => Record<string, any> }[],
  sortBy: 'solvedCount' | 'streak' | 'weeklyCount',
  currentUser?: CurrentLeaderboardUser
): LeaderboardEntry[] {
  const combinedMap = new Map<string, LeaderboardEntry>();

  snapDocs.forEach((docSnap) => {
    const data = docSnap.data();
    const uid = data.uid || docSnap.id;
    if (uid) {
      combinedMap.set(uid, {
        uid,
        displayName: data.displayName || 'Pacer',
        photoURL: data.photoURL || '',
        solvedCount: Number(data.solvedCount) || 0,
        streak: Number(data.streak) || 0,
        weeklyCount: Number(data.weeklyCount) || 0,
        activeDays: Number(data.activeDays) || 0,
        updatedAt: Number(data.updatedAt) || Date.now(),
      });
    }
  });

  // Always ensure current signed-in user is present with accurate local stats
  if (currentUser && currentUser.uid) {
    const existing = combinedMap.get(currentUser.uid);
    combinedMap.set(currentUser.uid, {
      uid: currentUser.uid,
      displayName: currentUser.displayName || existing?.displayName || 'You',
      photoURL: currentUser.photoURL || existing?.photoURL || '',
      solvedCount: currentUser.solvedCount,
      streak: currentUser.streak,
      weeklyCount: currentUser.weeklyCount,
      activeDays: currentUser.activeDays,
      updatedAt: Date.now(),
      isCurrentUser: true,
    });
  }

  // Convert to array and sort strictly by metric
  const list = Array.from(combinedMap.values());
  list.sort((a, b) => {
    const diff = (b[sortBy] || 0) - (a[sortBy] || 0);
    if (diff !== 0) return diff;
    return (b.solvedCount || 0) - (a.solvedCount || 0);
  });

  // Assign real rank
  return list.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
    isCurrentUser: currentUser ? entry.uid === currentUser.uid : false,
  }));
}

/**
 * Subscribes to real-time updates from the Firestore leaderboard collection.
 * Triggers callback immediately and on every new user registration or solve update.
 */
export function subscribeLeaderboard(
  sortBy: 'solvedCount' | 'streak' | 'weeklyCount' = 'solvedCount',
  currentUser?: CurrentLeaderboardUser,
  onUpdate?: (entries: LeaderboardEntry[], error: LeaderboardError | null) => void
): () => void {
  if (!db) {
    if (onUpdate) {
      const fallbackList: LeaderboardEntry[] = currentUser && currentUser.uid ? [{
        uid: currentUser.uid,
        displayName: currentUser.displayName || 'You',
        photoURL: currentUser.photoURL,
        solvedCount: currentUser.solvedCount,
        streak: currentUser.streak,
        weeklyCount: currentUser.weeklyCount,
        activeDays: currentUser.activeDays,
        updatedAt: Date.now(),
        rank: 1,
        isCurrentUser: true,
      }] : [];
      onUpdate(fallbackList, null);
    }
    return () => {};
  }

  const unsubscribe = onSnapshot(
    collection(db, 'leaderboard'),
    (snap) => {
      const entries = processLeaderboardSnap(snap.docs, sortBy, currentUser);
      if (onUpdate) onUpdate(entries, null);
    },
    (err: any) => {
      console.warn('Firestore leaderboard real-time listener error:', err);
      const fallbackList: LeaderboardEntry[] = currentUser && currentUser.uid ? [{
        uid: currentUser.uid,
        displayName: currentUser.displayName || 'You',
        photoURL: currentUser.photoURL,
        solvedCount: currentUser.solvedCount,
        streak: currentUser.streak,
        weeklyCount: currentUser.weeklyCount,
        activeDays: currentUser.activeDays,
        updatedAt: Date.now(),
        rank: 1,
        isCurrentUser: true,
      }] : [];
      if (onUpdate) {
        onUpdate(fallbackList, {
          code: err?.code || 'unknown',
          message: err?.message || 'Firestore query error',
        });
      }
    }
  );

  return unsubscribe;
}

/**
 * One-time fetch for real users from Firestore leaderboard collection.
 */
export async function fetchLeaderboardEntries(
  sortBy: 'solvedCount' | 'streak' | 'weeklyCount' = 'solvedCount',
  currentUser?: CurrentLeaderboardUser
): Promise<LeaderboardEntry[]> {
  if (!db) {
    return currentUser && currentUser.uid
      ? [{
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'You',
          photoURL: currentUser.photoURL,
          solvedCount: currentUser.solvedCount,
          streak: currentUser.streak,
          weeklyCount: currentUser.weeklyCount,
          activeDays: currentUser.activeDays,
          updatedAt: Date.now(),
          rank: 1,
          isCurrentUser: true,
        }]
      : [];
  }

  try {
    const snap = await getDocs(query(collection(db, 'leaderboard'), limit(250)));
    return processLeaderboardSnap(snap.docs, sortBy, currentUser);
  } catch (err: any) {
    console.warn('Firestore leaderboard query error:', err);
    return processLeaderboardSnap([], sortBy, currentUser);
  }
}
