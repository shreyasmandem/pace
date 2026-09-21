import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from 'firebase/firestore';

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

// Persistent local cache = Firestore queues writes made while offline (or
// when a request just fails transiently) in IndexedDB and replays them the
// moment connectivity returns, instead of dropping them.
export const db = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
    })
  : null;

const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  if (!auth) return Promise.reject(new Error('Firebase is not configured'));
  return signInWithPopup(auth, googleProvider);
}

export function signOut() {
  if (!auth) return Promise.resolve();
  return firebaseSignOut(auth);
}
