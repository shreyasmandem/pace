import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
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

export async function publishToLeaderboard(
  uid: string,
  user: User | null,
  stats: {
    solvedCount: number;
    streak: number;
    weeklyCount: number;
    activeDays: number;
  }
): Promise<void> {
  if (!db || !uid) return;

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
        solvedCount: stats.solvedCount,
        streak: stats.streak,
        weeklyCount: stats.weeklyCount,
        activeDays: stats.activeDays,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not sync to leaderboard collection:', err);
  }
}

/**
 * Fetches real people from Firestore leaderboard collection.
 * Zero mock / fake data.
 */
export async function fetchLeaderboardEntries(
  sortBy: 'solvedCount' | 'streak' | 'weeklyCount' = 'solvedCount',
  currentUser?: {
    uid: string;
    displayName: string;
    photoURL?: string;
    solvedCount: number;
    streak: number;
    weeklyCount: number;
    activeDays: number;
  }
): Promise<LeaderboardEntry[]> {
  const combinedMap = new Map<string, LeaderboardEntry>();

  // Fetch real users from Firestore
  if (db) {
    try {
      const q = query(
        collection(db, 'leaderboard'),
        orderBy(sortBy, 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const data = docSnap.data() as LeaderboardEntry;
        if (data.uid) {
          combinedMap.set(data.uid, {
            ...data,
            solvedCount: data.solvedCount || 0,
            streak: data.streak || 0,
            weeklyCount: data.weeklyCount || 0,
            activeDays: data.activeDays || 0,
          });
        }
      });
    } catch (err) {
      console.warn('Firestore leaderboard query error:', err);
    }
  }

  // Ensure current signed-in user is present with accurate local stats
  if (currentUser && currentUser.uid) {
    combinedMap.set(currentUser.uid, {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'You',
      photoURL: currentUser.photoURL,
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
