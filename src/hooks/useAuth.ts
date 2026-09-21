import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { subscribeSyncStatus, type SyncStatus } from '../state/sync';

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [loading, setLoading] = useState(Boolean(auth));

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('signed-out');
  useEffect(() => subscribeSyncStatus(setStatus), []);
  return status;
}
