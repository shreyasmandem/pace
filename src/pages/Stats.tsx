import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Flame,
  Trophy,
  Zap,
  LogIn,
  CheckCircle2,
  Medal,
  Crown,
  LayoutGrid,
  BarChart3,
  X,
  ArrowRight,
} from 'lucide-react';
import { TRACK_META, TRACK_ORDER, ALL_TRACKS } from '../data';
import { useAggregateStat, useTrackStats } from '../hooks/useTrackStats';
import { usePaceStore, currentStreak } from '../state/store';
import { useAuthUser } from '../hooks/useAuth';
import { signInWithGoogle, db } from '../lib/firebase';
import {
  fetchLeaderboardEntries,
  publishToLeaderboard,
  longestStreak,
  calculateWeeklySolves,
  calculateTier,
  type LeaderboardEntry,
} from '../lib/leaderboard';
import Lane from '../components/Lane';
import InteractiveHeatmap from '../components/InteractiveHeatmap';
import AchievementBadges from '../components/AchievementBadges';
import styles from './Stats.module.css';

export default function Stats() {
  const { user } = useAuthUser();
  const aggregate = useAggregateStat();
  const trackStats = useTrackStats();
  const registeredTracks = usePaceStore((s) => s.registeredTracks || []);

  const progress = usePaceStore((s) => s.progress || {});
  const solveLog = usePaceStore((s) => s.solveLog || {});
  const streak = currentStreak(solveLog);
  const maxStreak = longestStreak(solveLog);
  const weeklySolves = calculateWeeklySolves(solveLog);
  const activeDaysCount = Object.keys(solveLog).filter(
    (k) => (solveLog[k] || 0) > 0
  ).length;

  // View mode: 'progress' | 'leaderboard' | 'both'
  const [viewMode, setViewMode] = useState<'progress' | 'leaderboard' | 'both'>(
    'both'
  );

  // Leaderboard tab state: 'solvedCount' | 'streak' | 'weeklyCount'
  const [leaderboardTab, setLeaderboardTab] = useState<
    'solvedCount' | 'streak' | 'weeklyCount'
  >('solvedCount');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [signingIn, setSigningIn] = useState(false);

  // Inspect competitor modal state
  const [inspectEntry, setInspectEntry] = useState<LeaderboardEntry | null>(null);

  // Difficulty breakdown across registered tracks
  const diffBreakdown = useMemo(() => {
    let easySolved = 0,
      easyTotal = 0;
    let medSolved = 0,
      medTotal = 0;
    let hardSolved = 0,
      hardTotal = 0;

    for (const trackId of registeredTracks) {
      const track = ALL_TRACKS[trackId];
      if (!track) continue;
      for (const group of track.groups) {
        for (const p of group.problems) {
          const diff = p.difficulty?.toLowerCase();
          const isSolved = progress[p.id];
          if (diff === 'easy') {
            easyTotal++;
            if (isSolved) easySolved++;
          } else if (diff === 'medium') {
            medTotal++;
            if (isSolved) medSolved++;
          } else if (diff === 'hard') {
            hardTotal++;
            if (isSolved) hardSolved++;
          }
        }
      }
    }

    return {
      easy: {
        solved: easySolved,
        total: easyTotal,
        pct: easyTotal ? Math.round((easySolved / easyTotal) * 100) : 0,
      },
      medium: {
        solved: medSolved,
        total: medTotal,
        pct: medTotal ? Math.round((medSolved / medTotal) * 100) : 0,
      },
      hard: {
        solved: hardSolved,
        total: hardTotal,
        pct: hardTotal ? Math.round((hardSolved / hardTotal) * 100) : 0,
      },
    };
  }, [progress, registeredTracks]);

  // Current user object for leaderboard
  const currentUserObj = useMemo(() => {
    if (!user) return undefined;
    return {
      uid: user.uid,
      displayName:
        user.displayName || (user.email ? user.email.split('@')[0] : 'You'),
      photoURL: user.photoURL || undefined,
      solvedCount: aggregate.solved,
      streak,
      weeklyCount: weeklySolves,
      activeDays: activeDaysCount,
    };
  }, [user, aggregate.solved, streak, weeklySolves, activeDaysCount]);

  // Auto-sync signed-in user's live score to Firestore leaderboard
  useEffect(() => {
    if (user && db) {
      publishToLeaderboard(user.uid, user, {
        solvedCount: aggregate.solved,
        streak,
        weeklyCount: weeklySolves,
        activeDays: activeDaysCount,
      });
    }
  }, [user, aggregate.solved, streak, weeklySolves, activeDaysCount]);

  // Load leaderboard entries
  useEffect(() => {
    let active = true;
    fetchLeaderboardEntries(leaderboardTab, currentUserObj).then((data) => {
      if (active) setLeaderboard(data);
    });
    return () => {
      active = false;
    };
  }, [leaderboardTab, currentUserObj]);

  const currentUserEntry = leaderboard.find((e) => e.isCurrentUser);
  const userRank = currentUserEntry?.rank ?? null;
  const userTier = calculateTier(aggregate.solved);

  // Next user to overtake for motivation
  const nextTargetEntry =
    userRank && userRank > 1 ? leaderboard[userRank - 2] : null;

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.warn('Google sign-in error:', err);
    } finally {
      setSigningIn(false);
    }
  };

  // Real podium top 3 only when 3 or more real competitors exist
  const podiumTop3 = leaderboard.length >= 3 ? leaderboard.slice(0, 3) : [];
  const tableRows = leaderboard.length >= 3 ? leaderboard.slice(3) : leaderboard;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.heading}>Progress, Streaks &amp; Leaderboard</h1>
          <p className={styles.sub}>
            Real-time performance analytics, solve consistency, and global community
            rankings. Compete with everyone who joins Pace.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className={styles.viewModeToggle}>
          <button
            className={`${styles.viewModeBtn} ${
              viewMode === 'progress' ? styles.viewModeBtnActive : ''
            }`}
            onClick={() => setViewMode('progress')}
          >
            <BarChart3 size={15} />
            <span>My Progress</span>
          </button>
          <button
            className={`${styles.viewModeBtn} ${
              viewMode === 'leaderboard' ? styles.viewModeBtnActive : ''
            }`}
            onClick={() => setViewMode('leaderboard')}
          >
            <Trophy size={15} />
            <span>Leaderboard</span>
            {userRank && (
              <span className={styles.modeBadge}>#{userRank}</span>
            )}
          </button>
          <button
            className={`${styles.viewModeBtn} ${
              viewMode === 'both' ? styles.viewModeBtnActive : ''
            }`}
            onClick={() => setViewMode('both')}
          >
            <LayoutGrid size={15} />
            <span>Unified</span>
          </button>
        </div>
      </header>

      {/* Metrics Overview Strip */}
      <section className={styles.metricsGrid}>
        <div className={styles.metricCard} onClick={() => setViewMode('progress')}>
          <div className={styles.metricTop}>
            <span>Total Solved</span>
            <CheckCircle2 size={15} color="var(--difficulty-easy)" />
          </div>
          <span className={styles.metricValue}>{aggregate.solved}</span>
          <span className={styles.metricSub}>
            {Math.round(aggregate.percent)}% of {aggregate.total} curriculum problems
          </span>
        </div>

        <div className={styles.metricCard} onClick={() => setViewMode('progress')}>
          <div className={styles.metricTop}>
            <span>Active Streak</span>
            <Flame
              size={15}
              color={streak > 0 ? 'var(--accent)' : 'var(--text-tertiary)'}
            />
          </div>
          <span className={styles.metricValue}>
            {streak} <span style={{ fontSize: '1rem' }}>days</span>
          </span>
          <span className={styles.metricSub}>
            {streak > 0 ? 'Keep the fire burning today!' : 'Solve a problem to start'}
          </span>
        </div>

        <div className={styles.metricCard} onClick={() => setViewMode('progress')}>
          <div className={styles.metricTop}>
            <span>All-Time Longest</span>
            <Zap size={15} color="#f0b429" />
          </div>
          <span className={styles.metricValue}>
            {maxStreak} <span style={{ fontSize: '1rem' }}>days</span>
          </span>
          <span className={styles.metricSub}>Your personal record run</span>
        </div>

        <div
          className={styles.metricCard}
          onClick={() => setViewMode('leaderboard')}
          title="Click to view full Leaderboard"
        >
          <div className={styles.metricTop}>
            <span>Global Standing</span>
            <Trophy size={15} color="var(--accent)" />
          </div>
          <span className={styles.metricValue}>
            {userRank ? `#${userRank}` : 'Unranked'}
          </span>
          <span className={styles.metricSub}>
            {user ? 'View Community Rankings →' : 'Sign in to claim rank →'}
          </span>
        </div>
      </section>

      {/* Integrated Leaderboard Snapshot inside Progress View */}
      {(viewMode === 'progress' || viewMode === 'both') && (
        <section className={styles.progressLeaderboardCard}>
          <div className={styles.plLeft}>
            <div className={styles.plRankMedal}>
              {userRank && userRank <= 3
                ? userRank === 1
                  ? '👑'
                  : userRank === 2
                  ? '🥈'
                  : '🥉'
                : '🏆'}
            </div>
            <div className={styles.plInfo}>
              <div className={styles.plTitleRow}>
                <span className={styles.plTitle}>Community Standing</span>
                <span className={styles.plRankTag}>
                  {userRank ? `Rank #${userRank}` : 'Unregistered'}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: userTier.color,
                  }}
                >
                  {userTier.tier} Tier
                </span>
              </div>
              <span className={styles.plSub}>
                {nextTargetEntry ? (
                  <span>
                    🔥 Solve{' '}
                    <strong>
                      {nextTargetEntry.solvedCount - aggregate.solved + 1} more problems
                    </strong>{' '}
                    to pass {nextTargetEntry.displayName} (#{nextTargetEntry.rank})!
                  </span>
                ) : user ? (
                  '🎉 Outstanding! You hold the #1 throne on the Pace leaderboard.'
                ) : (
                  'Sign in with Google to publish your score and compete with registered solvers.'
                )}
              </span>
            </div>
          </div>

          <button
            className={styles.plActionBtn}
            onClick={() => setViewMode('leaderboard')}
          >
            <span>View Full Leaderboard</span>
            <ArrowRight size={14} />
          </button>
        </section>
      )}

      {/* Global Community Leaderboard Section */}
      {(viewMode === 'leaderboard' || viewMode === 'both') && (
        <section className={styles.leaderboardSection}>
          <div className={styles.leaderboardHeader}>
            <div className={styles.leaderboardTitleGroup}>
              <span className={styles.livePulseDot} />
              <h2 className={styles.leaderboardTitle}>Global Leaderboard</h2>
            </div>

            <div className={styles.tabs}>
              <button
                className={`${styles.tabBtn} ${
                  leaderboardTab === 'solvedCount' ? styles.tabBtnActive : ''
                }`}
                onClick={() => setLeaderboardTab('solvedCount')}
              >
                <Trophy size={13} />
                <span>Top Solvers</span>
              </button>

              <button
                className={`${styles.tabBtn} ${
                  leaderboardTab === 'streak' ? styles.tabBtnActive : ''
                }`}
                onClick={() => setLeaderboardTab('streak')}
              >
                <Flame size={13} />
                <span>Streak Masters</span>
              </button>

              <button
                className={`${styles.tabBtn} ${
                  leaderboardTab === 'weeklyCount' ? styles.tabBtnActive : ''
                }`}
                onClick={() => setLeaderboardTab('weeklyCount')}
              >
                <Zap size={13} />
                <span>Weekly Sprint</span>
              </button>
            </div>
          </div>

          {/* Top 3 Podium */}
          {podiumTop3.length >= 3 && (
            <div className={styles.podiumGrid}>
              {/* Rank 2 - Silver */}
              <div
                className={`${styles.podiumCard} ${styles.podium2}`}
                onClick={() => setInspectEntry(podiumTop3[1])}
              >
                <div className={styles.podiumCrown}>🥈</div>
                <div className={styles.avatarWrap}>
                  {podiumTop3[1].photoURL ? (
                    <img
                      src={podiumTop3[1].photoURL}
                      alt=""
                      className={styles.avatarImg}
                    />
                  ) : (
                    <span>{podiumTop3[1].displayName[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <span className={styles.podiumName}>
                  {podiumTop3[1].displayName}
                  {podiumTop3[1].isCurrentUser && ' (You)'}
                </span>
                <span className={styles.podiumScore}>
                  {leaderboardTab === 'streak'
                    ? `${podiumTop3[1].streak}d`
                    : leaderboardTab === 'weeklyCount'
                    ? podiumTop3[1].weeklyCount
                    : podiumTop3[1].solvedCount}
                </span>
                <span className={styles.podiumScoreLabel}>
                  {leaderboardTab === 'streak'
                    ? 'Active Streak'
                    : leaderboardTab === 'weeklyCount'
                    ? 'Solved this week'
                    : 'Problems Solved'}
                </span>
                <div className={styles.podiumStreak}>
                  <Flame size={12} />
                  <span>{podiumTop3[1].streak} day streak</span>
                </div>
              </div>

              {/* Rank 1 - Gold */}
              <div
                className={`${styles.podiumCard} ${styles.podium1}`}
                onClick={() => setInspectEntry(podiumTop3[0])}
              >
                <div className={styles.podiumCrown}>👑</div>
                <div className={styles.avatarWrap}>
                  {podiumTop3[0].photoURL ? (
                    <img
                      src={podiumTop3[0].photoURL}
                      alt=""
                      className={styles.avatarImg}
                    />
                  ) : (
                    <span>{podiumTop3[0].displayName[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <span className={styles.podiumName}>
                  {podiumTop3[0].displayName}
                  {podiumTop3[0].isCurrentUser && ' (You)'}
                </span>
                <span className={styles.podiumScore}>
                  {leaderboardTab === 'streak'
                    ? `${podiumTop3[0].streak}d`
                    : leaderboardTab === 'weeklyCount'
                    ? podiumTop3[0].weeklyCount
                    : podiumTop3[0].solvedCount}
                </span>
                <span className={styles.podiumScoreLabel}>
                  {leaderboardTab === 'streak'
                    ? 'Active Streak'
                    : leaderboardTab === 'weeklyCount'
                    ? 'Solved this week'
                    : 'Problems Solved'}
                </span>
                <div className={styles.podiumStreak}>
                  <Flame size={12} />
                  <span>{podiumTop3[0].streak} day streak</span>
                </div>
              </div>

              {/* Rank 3 - Bronze */}
              <div
                className={`${styles.podiumCard} ${styles.podium3}`}
                onClick={() => setInspectEntry(podiumTop3[2])}
              >
                <div className={styles.podiumCrown}>🥉</div>
                <div className={styles.avatarWrap}>
                  {podiumTop3[2].photoURL ? (
                    <img
                      src={podiumTop3[2].photoURL}
                      alt=""
                      className={styles.avatarImg}
                    />
                  ) : (
                    <span>{podiumTop3[2].displayName[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <span className={styles.podiumName}>
                  {podiumTop3[2].displayName}
                  {podiumTop3[2].isCurrentUser && ' (You)'}
                </span>
                <span className={styles.podiumScore}>
                  {leaderboardTab === 'streak'
                    ? `${podiumTop3[2].streak}d`
                    : leaderboardTab === 'weeklyCount'
                    ? podiumTop3[2].weeklyCount
                    : podiumTop3[2].solvedCount}
                </span>
                <span className={styles.podiumScoreLabel}>
                  {leaderboardTab === 'streak'
                    ? 'Active Streak'
                    : leaderboardTab === 'weeklyCount'
                    ? 'Solved this week'
                    : 'Problems Solved'}
                </span>
                <div className={styles.podiumStreak}>
                  <Flame size={12} />
                  <span>{podiumTop3[2].streak} day streak</span>
                </div>
              </div>
            </div>
          )}

          {leaderboard.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
              <Crown size={32} color="var(--accent)" style={{ marginBottom: '8px' }} />
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                No Competitors Yet
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', maxWidth: '42ch', margin: '0 auto 16px' }}>
                Be the first to sign in with your Google account and claim Rank #1 on the Pace leaderboard!
              </p>
              {!user && (
                <button className={styles.signInBtn} onClick={handleSignIn} disabled={signingIn}>
                  <LogIn size={14} />
                  <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
                </button>
              )}
            </div>
          )}

          {/* Table rows */}
          {tableRows.length > 0 && (
            <div className={styles.leaderboardTable}>
              <div className={styles.rowHeader}>
                <span>Rank</span>
                <span>Solver</span>
                <span className={styles.tierCell}>Tier</span>
                <span className={styles.streakCell}>Streak</span>
                <span style={{ textAlign: 'right' }}>
                  {leaderboardTab === 'streak'
                    ? 'Streak'
                    : leaderboardTab === 'weeklyCount'
                    ? 'Weekly'
                    : 'Solved'}
                </span>
              </div>

              {tableRows.map((entry) => {
              const tierMeta = calculateTier(entry.solvedCount);
              const isMe = entry.isCurrentUser;
              const primaryScore =
                leaderboardTab === 'streak'
                  ? `${entry.streak}d`
                  : leaderboardTab === 'weeklyCount'
                  ? entry.weeklyCount
                  : entry.solvedCount;

              return (
                <div
                  key={entry.uid}
                  className={`${styles.leaderboardRow} ${
                    isMe ? styles.rowCurrentUser : ''
                  }`}
                  onClick={() => setInspectEntry(entry)}
                  title="Click to view solver details"
                >
                  <span className={styles.rankBadge}>
                    {entry.rank && entry.rank <= 3 ? (
                      entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'
                    ) : (
                      `#${entry.rank}`
                    )}
                  </span>

                  <div className={styles.solverCell}>
                    <div className={styles.userAvatarSm}>
                      {entry.photoURL ? (
                        <img
                          src={entry.photoURL}
                          alt=""
                          className={styles.avatarImg}
                        />
                      ) : (
                        <span>{entry.displayName[0]?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    <div className={styles.solverInfo}>
                      <span className={styles.solverName}>
                        {entry.displayName}
                      </span>
                      {isMe && <span className={styles.youBadge}>You</span>}
                    </div>
                  </div>

                  <div className={styles.tierCell}>
                    <span
                      className={styles.tierPill}
                      style={{ color: tierMeta.color, background: tierMeta.bg }}
                    >
                      {tierMeta.tier}
                    </span>
                  </div>

                  <div className={styles.streakCell}>
                    <Flame
                      size={13}
                      color={
                        entry.streak > 0 ? 'var(--accent)' : 'var(--text-tertiary)'
                      }
                    />
                    <span>{entry.streak}d</span>
                  </div>

                  <span className={styles.scoreCell}>{primaryScore}</span>
                </div>
              );
            })}
          </div>
          )}

          {/* Personal Rank / Join Banner */}
          <div className={styles.personalBanner}>
            <div className={styles.personalLeft}>
              <div className={styles.personalRankIcon}>
                {user ? (
                  userRank && userRank <= 3 ? (
                    userRank === 1 ? '👑' : userRank === 2 ? '🥈' : '🥉'
                  ) : (
                    <Medal size={20} color="var(--accent)" />
                  )
                ) : (
                  <Crown size={20} color="var(--accent)" />
                )}
              </div>
              <div className={styles.personalText}>
                <span className={styles.personalTitle}>
                  {user
                    ? userRank
                      ? `You are ranked #${userRank} globally!`
                      : 'Your rank is calculating...'
                    : 'Compete with everyone on Pace'}
                </span>
                <span className={styles.personalSub}>
                  {user ? (
                    nextTargetEntry ? (
                      <span>
                        🔥 Solve{' '}
                        <strong>
                          {leaderboardTab === 'streak'
                            ? nextTargetEntry.streak - streak + 1
                            : nextTargetEntry.solvedCount - aggregate.solved + 1}{' '}
                          more{' '}
                          {leaderboardTab === 'streak' ? 'consecutive days' : 'problems'}
                        </strong>{' '}
                        to overtake {nextTargetEntry.displayName} (#{nextTargetEntry.rank})!
                      </span>
                    ) : (
                      '🎉 You are at the very top of the leaderboard! Defend your throne.'
                    )
                  ) : (
                    'Sign in with Google in 1-click to publish your solves, climb the leaderboard, and unlock competitive badges.'
                  )}
                </span>
              </div>
            </div>

            {!user && (
              <button
                className={styles.signInBtn}
                onClick={handleSignIn}
                disabled={signingIn}
              >
                <LogIn size={14} />
                <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Difficulty Breakdown */}
      {(viewMode === 'progress' || viewMode === 'both') && (
        <section className={styles.diffSection}>
          <div className={styles.diffHeader}>
            <span className={styles.diffTitle}>Curriculum Mastery by Difficulty</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              {registeredTracks.length > 0
                ? `Across your ${registeredTracks.length} registered track${registeredTracks.length > 1 ? 's' : ''}`
                : 'No tracks registered'}
            </span>
          </div>

          <div className={styles.diffGrid}>
            <div className={styles.diffCard}>
              <div className={styles.diffCardTop}>
                <span
                  className={styles.diffCardName}
                  style={{ color: 'var(--difficulty-easy)' }}
                >
                  Easy
                </span>
                <span className={styles.diffCardValue}>
                  {diffBreakdown.easy.solved}/{diffBreakdown.easy.total}
                </span>
              </div>
              <div className={styles.diffBarTrack}>
                <div
                  className={`${styles.diffBarFill} ${styles.easyFill}`}
                  style={{ width: `${diffBreakdown.easy.pct}%` }}
                />
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                {diffBreakdown.easy.pct}% completed
              </span>
            </div>

            <div className={styles.diffCard}>
              <div className={styles.diffCardTop}>
                <span
                  className={styles.diffCardName}
                  style={{ color: 'var(--difficulty-medium)' }}
                >
                  Medium
                </span>
                <span className={styles.diffCardValue}>
                  {diffBreakdown.medium.solved}/{diffBreakdown.medium.total}
                </span>
              </div>
              <div className={styles.diffBarTrack}>
                <div
                  className={`${styles.diffBarFill} ${styles.mediumFill}`}
                  style={{ width: `${diffBreakdown.medium.pct}%` }}
                />
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                {diffBreakdown.medium.pct}% completed
              </span>
            </div>

            <div className={styles.diffCard}>
              <div className={styles.diffCardTop}>
                <span
                  className={styles.diffCardName}
                  style={{ color: 'var(--difficulty-hard)' }}
                >
                  Hard
                </span>
                <span className={styles.diffCardValue}>
                  {diffBreakdown.hard.solved}/{diffBreakdown.hard.total}
                </span>
              </div>
              <div className={styles.diffBarTrack}>
                <div
                  className={`${styles.diffBarFill} ${styles.hardFill}`}
                  style={{ width: `${diffBreakdown.hard.pct}%` }}
                />
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                {diffBreakdown.hard.pct}% completed
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Interactive Heatmap */}
      {(viewMode === 'progress' || viewMode === 'both') && (
        <InteractiveHeatmap solveLog={solveLog} />
      )}

      {/* Achievement & Milestones Badges */}
      {(viewMode === 'progress' || viewMode === 'both') && (
        <AchievementBadges
          solvedCount={aggregate.solved}
          streak={streak}
          maxStreak={maxStreak}
          solveLog={solveLog}
          userRank={userRank}
        />
      )}

      {/* By Track Progress Breakdown */}
      {(viewMode === 'progress' || viewMode === 'both') && (
        <section className={styles.trackBlock}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h2 className={styles.blockTitle} style={{ margin: 0 }}>Registered Track Completion</h2>
            <Link to="/settings" style={{ fontSize: '0.78rem', color: 'var(--accent)', textDecoration: 'none' }}>
              Manage Tracks →
            </Link>
          </div>
          {registeredTracks.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hairline)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                You have not registered for any tracks yet. Register for a track to unlock your completion breakdown and progress analytics.
              </p>
              <Link to="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
                Register for Tracks <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className={styles.trackList}>
              {registeredTracks.map((id) => {
                const meta = TRACK_META[id];
                const stat = trackStats[id];
                return (
                  <Link
                    key={id}
                    to={`/track/${id}`}
                    className={styles.trackRow}
                    title={`Open ${meta.label}`}
                  >
                    <span className={styles.trackName}>{meta.shortLabel}</span>
                    <div className={styles.trackLaneWrap}>
                      <Lane percent={stat.percent} color={meta.accent} />
                    </div>
                    <span className={`${styles.trackFraction} mono`}>
                      {stat.solved}/{stat.total}
                    </span>
                    <span
                      style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}
                    >
                      {Math.round(stat.percent)}%
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Competitor Comparison Modal */}
      {inspectEntry && (
        <div
          className={styles.modalOverlay}
          onClick={() => setInspectEntry(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Competitor Profile</h3>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setInspectEntry(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.compareProfileTop}>
                <div className={styles.compareAvatar}>
                  {inspectEntry.photoURL ? (
                    <img
                      src={inspectEntry.photoURL}
                      alt=""
                      className={styles.avatarImg}
                    />
                  ) : (
                    <span>{inspectEntry.displayName[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <div className={styles.compareDetails}>
                  <span className={styles.compareName}>
                    {inspectEntry.displayName}
                    {inspectEntry.isCurrentUser && ' (You)'}
                  </span>
                  <div className={styles.compareMeta}>
                    <span
                      className={styles.tierPill}
                      style={{
                        color: calculateTier(inspectEntry.solvedCount).color,
                        background: calculateTier(inspectEntry.solvedCount).bg,
                      }}
                    >
                      {calculateTier(inspectEntry.solvedCount).tier}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Rank #{inspectEntry.rank}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.compareCardGrid}>
                <div className={styles.compareCard}>
                  <span className={styles.compareCardLabel}>Total Solved</span>
                  <span className={styles.compareCardVal}>
                    {inspectEntry.solvedCount}
                  </span>
                </div>
                <div className={styles.compareCard}>
                  <span className={styles.compareCardLabel}>Active Streak</span>
                  <span className={styles.compareCardVal}>
                    {inspectEntry.streak} days
                  </span>
                </div>
                <div className={styles.compareCard}>
                  <span className={styles.compareCardLabel}>Weekly Solves</span>
                  <span className={styles.compareCardVal}>
                    {inspectEntry.weeklyCount}
                  </span>
                </div>
                <div className={styles.compareCard}>
                  <span className={styles.compareCardLabel}>Active Days</span>
                  <span className={styles.compareCardVal}>
                    {inspectEntry.activeDays}
                  </span>
                </div>
              </div>

              <div className={styles.compareNudgeBox}>
                {inspectEntry.isCurrentUser ? (
                  <span>
                    👑 This is your profile! Keep solving daily to defend and advance
                    your global ranking.
                  </span>
                ) : aggregate.solved >= inspectEntry.solvedCount ? (
                  <span>
                    ✨ You lead {inspectEntry.displayName} by{' '}
                    <strong>
                      {aggregate.solved - inspectEntry.solvedCount} solved problems
                    </strong>
                    . Keep pushing!
                  </span>
                ) : (
                  <span>
                    🎯 You need{' '}
                    <strong>
                      {inspectEntry.solvedCount - aggregate.solved} more solves
                    </strong>{' '}
                    to match {inspectEntry.displayName}&apos;s rank!
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
