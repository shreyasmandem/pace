import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import { useAuthUser } from '../hooks/useAuth';
import { publishToLeaderboard, calculateWeeklySolves } from '../lib/leaderboard';
import { usePaceStore, currentStreak } from '../state/store';
import {
  signInWithGoogle,
  logInWithEmail,
  signUpWithEmail,
  resetPassword,
  signOut,
  firebaseEnabled,
} from '../lib/firebase';
import styles from './AuthPage.module.css';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
}

function getFriendlyErrorMessage(err: any): string {
  const code = err?.code || '';
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Invalid email address or password. Please check your credentials.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in was cancelled.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection error. Check your internet connection.';
  }
  return err?.message || 'Authentication failed. Please try again.';
}

export default function AuthPage({ initialMode = 'login' }: AuthPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectTo = searchParams.get('redirect') || '/';

  const { user, loading: authLoading } = useAuthUser();
  const [mode, setMode] = useState<'login' | 'signup'>(
    searchParams.get('mode') === 'signup' || initialMode === 'signup' ? 'signup' : 'login'
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    setSuccessMessage(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const cred = await signUpWithEmail(cleanEmail, password, name.trim() || undefined);
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
      } else {
        const cred = await logInWithEmail(cleanEmail, password);
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
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address above to reset your password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(cleanEmail);
      setSuccessMessage(`Password reset link sent to ${cleanEmail}. Check your inbox.`);
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
          <h1 className={styles.title}>
            {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
          </h1>
          <p className={styles.subtitle}>
            {mode === 'login'
              ? 'Log in to sync your solved progress, notes, and roadmap.'
              : 'Join Pace to compete on the global leaderboard & sync progress.'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className={styles.tabToggle}>
          <button
            type="button"
            className={`${styles.tabBtn} ${mode === 'login' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Log In
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${mode === 'signup' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <AlertCircle size={15} style={{ flex: 'none' }} />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className={styles.successBox}>
            <CheckCircle2 size={15} style={{ flex: 'none' }} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1-Click Google Sign In */}
        {firebaseEnabled && (
          <>
            <button
              type="button"
              className={styles.googleBtn}
              onClick={handleGoogleAuth}
              disabled={loading}
            >
              <svg className={styles.googleIcon} viewBox="0 0 24 24">
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
              <span>Continue with Google</span>
            </button>

            <div className={styles.divider}>
              <span>or with email</span>
            </div>
          </>
        )}

        {/* Email & Password Form */}
        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className={styles.inputGroup}>
              <label className={styles.label}>Full Name / Display Name</label>
              <div className={styles.inputWrap}>
                <input
                  type="text"
                  placeholder="e.g. Shreyas"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={styles.input}
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className={styles.inputGroup}>
            <label className={styles.label}>Email Address</label>
            <div className={styles.inputWrap}>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Password</label>
              {mode === 'login' && (
                <button
                  type="button"
                  className={styles.forgotLink}
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className={styles.inputWrap}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${styles.input} ${styles.passwordInput}`}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <label className={styles.rememberRow}>
            <input type="checkbox" defaultChecked />
            <span>Stay signed in on this device across sessions</span>
          </label>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            <span>{loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className={styles.footerRow}>
          <span>
            {mode === 'login' ? "Don't have an account yet?" : 'Already have an account?'}
          </span>
          <button
            type="button"
            className={styles.footerLink}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
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
