import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  LogOut,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useAuthUser } from '../hooks/useAuth';
import { publishToLeaderboard, calculateWeeklySolves } from '../lib/leaderboard';
import { usePaceStore, currentStreak } from '../state/store';
import {
  signInWithGoogle,
  signOut,
  firebaseEnabled,
} from '../lib/firebase';
import styles from './AuthPage.module.css';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
}

function getFriendlyErrorMessage(err: any): string {
  const code = err?.code || '';
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in was cancelled.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection error. Check your internet connection.';
  }
  return err?.message || 'Authentication failed. Please try again.';
}

export default function AuthPage({}: AuthPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectTo = searchParams.get('redirect') || '/';

  const { user, loading: authLoading } = useAuthUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, show user account details with option to continue or sign out
  if (!authLoading && user) {
    return (
      <div className={styles.page}>
        <div className={styles.authCard}>
          <div className={styles.brandHeader}>
            <img src="/pace-mark.png" alt="Pace" className={styles.mark} />
            <h1 className={styles.title}>You are signed in</h1>
            <p className={styles.subtitle}>Your session is active and syncing across devices.</p>
          </div>

          <div className={styles.signedInCard}>
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className={styles.avatarLg} />
            ) : (
              <div className={styles.initialLg}>
                {(user.displayName || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className={styles.signedInName}>{user.displayName || 'Pace Solver'}</p>
              <p className={styles.signedInEmail}>{user.email}</p>
            </div>

            <div className={styles.signedInActions}>
              <button className={styles.submitBtn} onClick={() => navigate(redirectTo)}>
                <span>Continue to Dashboard</span>
                <ArrowRight size={16} />
              </button>
              <button
                className={styles.googleBtn}
                onClick={async () => {
                  await signOut();
                }}
              >
                <LogOut size={16} />
                <span>Sign Out / Switch Account</span>
              </button>
            </div>
          </div>

          <div className={styles.backRow} style={{ textAlign: 'center' }}>
            <Link to="/" className={styles.backLink}>
              <ArrowLeft size={14} />
              <span>Back to Pace</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithGoogle();
      if (cred?.user) {
        const store = usePaceStore.getState();
        publishToLeaderboard(cred.user.uid, cred.user, {
          solvedCount: Object.keys(store.progress || {}).length,
          streak: currentStreak(store.solveLog || {}),
          weeklyCount: calculateWeeklySolves(store.solveLog || {}),
          activeDays: Object.keys(store.solveLog || {}).length,
        });
      }
      navigate(redirectTo);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.authCard}>
        <div className={styles.brandHeader}>
          <img src="/pace-mark.png" alt="Pace" className={styles.mark} />
          <h1 className={styles.title}>Sign in to Pace</h1>
          <p className={styles.subtitle}>
            One click to sync your progress across devices and compete on the global community leaderboard.
          </p>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <AlertCircle size={15} style={{ flex: 'none' }} />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Google Sign In */}
        {firebaseEnabled ? (
          <div style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <button
              type="button"
              className={styles.googleBtn}
              onClick={handleGoogleAuth}
              disabled={loading}
              style={{
                height: '46px',
                fontSize: '0.92rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              }}
            >
              <svg className={styles.googleIcon} viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Signing in with Google…' : 'Continue with Google'}</span>
            </button>
          </div>
        ) : (
          <p className={styles.subtitle} style={{ textAlign: 'center' }}>
            Firebase authentication is not configured in this environment.
          </p>
        )}

        <div className={styles.backRow} style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
          <Link to="/" className={styles.backLink}>
            <ArrowLeft size={14} />
            <span>Back to Pace</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
