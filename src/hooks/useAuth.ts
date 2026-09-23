import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { subscribeSyncStatus, type SyncStatus } from '../state/sync';

function getCachedUser(): Partial<User> | null {
  try {
    const raw = localStorage.getItem('pace_cached_auth_user');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

const profileListeners = new Set<() => void>();

export function notifyProfileUpdated() {
  profileListeners.forEach((fn) => fn());
}

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(() => (auth?.currentUser as User) ?? (getCachedUser() as User) ?? null);
  const [loading, setLoading] = useState(Boolean(auth && !auth.currentUser && !getCachedUser()));

  useEffect(() => {
    const handleProfileUpdate = () => {
      const currentUser = (auth?.currentUser as User) ?? (getCachedUser() as User) ?? null;
      setUser(currentUser ? { ...currentUser } : null);
    };
    profileListeners.add(handleProfileUpdate);
    return () => {
      profileListeners.delete(handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        try {
          localStorage.setItem(
            'pace_cached_auth_user',
            JSON.stringify({
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
            })
          );
        } catch {
          // ignore
        }
      } else {
        try {
          localStorage.removeItem('pace_cached_auth_user');
        } catch {
          // ignore
        }
      }
    });
  }, []);

  return { user, loading };
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('signed-out');
  useEffect(() => subscribeSyncStatus(setStatus), []);
  return status;
}
