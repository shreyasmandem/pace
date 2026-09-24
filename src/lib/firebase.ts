import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { usePaceStore } from '../state/store';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(firebaseConfig.apiKey);

export const app = firebaseEnabled ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;

// Ensure auth session persists in localStorage across browser sessions/restarts
if (auth) {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase setPersistence error:', err);
  });
}

// Persistent local cache = Firestore queues writes made while offline in IndexedDB
export const db = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
    })
  : null;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle() {
  if (!auth) return Promise.reject(new Error('Firebase is not configured'));
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;
  if (!user || !db) return cred;

  try {
    const modDoc = await getDoc(doc(db, 'system', 'moderation'));
    if (modDoc.exists()) {
      const modData = modDoc.data();
      const bannedUsers: string[] = Array.isArray(modData.bannedUsers) ? modData.bannedUsers : [];
      if (bannedUsers.includes(user.uid)) {
        await firebaseSignOut(auth);
        try {
          sessionStorage.setItem('pace_account_suspended_notice', 'true');
        } catch {
          // ignore
        }
        throw new Error('This account has been suspended by an administrator.');
      }

      const deletedUsers: string[] = Array.isArray(modData.deletedUsers) ? modData.deletedUsers : [];
      if (deletedUsers.includes(user.uid)) {
        // User was previously deleted by admin and is now signing up with Google again.
        // Remove from deleted list so they can use their fresh account.
        const updatedDeleted = deletedUsers.filter((id) => id !== user.uid);
        try {
          await setDoc(doc(db, 'system', 'moderation'), { deletedUsers: updatedDeleted, updatedAt: Date.now() }, { merge: true });
        } catch {
          // ignore
        }
        try {
          const raw = localStorage.getItem('pace_admin_deleted_users_v1');
          if (raw) {
            const list = JSON.parse(raw);
            localStorage.setItem('pace_admin_deleted_users_v1', JSON.stringify(list.filter((id: string) => id !== user.uid)));
          }
        } catch {
          // ignore
        }

        // Reset local store so they start with 0 progress
        try {
          usePaceStore.getState().resetAll();
        } catch {
          // ignore
        }

        // Initialize fresh empty Firestore records
        try {
          await setDoc(doc(db, 'users', user.uid), {
            progress: {},
            notes: {},
            bookmarks: {},
            solveLog: {},
            planner: {},
            registeredTracks: [],
            tutorChats: {},
            resetVersion: 2,
            updatedAt: Date.now(),
            deleted: false,
          });
          await setDoc(doc(db, 'leaderboard', user.uid), {
            displayName: user.displayName || 'Pacer',
            photoURL: user.photoURL || '',
            solvedCount: 0,
            streak: 0,
            weeklyCount: 0,
            activeDays: 0,
            updatedAt: Date.now(),
            deleted: false,
          });
        } catch {
          // ignore
        }
      }
    }
  } catch (err: any) {
    if (err?.message?.includes('suspended')) {
      throw err;
    }
    console.warn('Error checking moderation during sign-in:', err);
  }

  return cred;
}

export async function logInWithEmail(email: string, pass: string) {
  if (!auth) return Promise.reject(new Error('Firebase is not configured'));
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  const user = cred.user;
  if (!user || !db) return cred;

  try {
    const modDoc = await getDoc(doc(db, 'system', 'moderation'));
    if (modDoc.exists()) {
      const modData = modDoc.data();
      const bannedUsers: string[] = Array.isArray(modData.bannedUsers) ? modData.bannedUsers : [];
      if (bannedUsers.includes(user.uid)) {
        await firebaseSignOut(auth);
        try {
          sessionStorage.setItem('pace_account_suspended_notice', 'true');
        } catch {
          // ignore
        }
        throw new Error('This account has been suspended by an administrator.');
      }
    }
  } catch (err: any) {
    if (err?.message?.includes('suspended')) {
      throw err;
    }
  }

  return cred;
}

export async function signUpWithEmail(email: string, pass: string, displayName?: string) {
  if (!auth) return Promise.reject(new Error('Firebase is not configured'));
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName && cred.user) {
    await updateProfile(cred.user, { displayName });
  }
  return cred;
}

export function resetPassword(email: string) {
  if (!auth) return Promise.reject(new Error('Firebase is not configured'));
  return sendPasswordResetEmail(auth, email);
}

export function signOut() {
  if (!auth) return Promise.resolve();
  try {
    localStorage.removeItem('pace_cached_auth_user');
  } catch {
    // ignore
  }
  return firebaseSignOut(auth);
}

export async function updateUserDisplayName(newDisplayName: string) {
  if (!auth?.currentUser) throw new Error('Not authenticated');
  await updateProfile(auth.currentUser, { displayName: newDisplayName });
  try {
    const cached = localStorage.getItem('pace_cached_auth_user');
    if (cached) {
      const parsed = JSON.parse(cached);
      parsed.displayName = newDisplayName;
      localStorage.setItem('pace_cached_auth_user', JSON.stringify(parsed));
    }
  } catch {
    // ignore
  }
}

