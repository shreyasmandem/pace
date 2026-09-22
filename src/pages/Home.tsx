import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bookmark,
  Flame,
  NotebookPen,
  CalendarDays,
  Check,
  Sparkles,
} from 'lucide-react';
import { TRACK_META, TRACK_ORDER } from '../data';
import { getDailyQuote, getDayOfYear } from '../data/dailyQuotes';
import { useAggregateStat, useTrackStats } from '../hooks/useTrackStats';
import { useAuthUser } from '../hooks/useAuth';
import { usePaceStore, currentStreak } from '../state/store';
import PaceRing from '../components/PaceRing';
import Lane from '../components/Lane';
import styles from './Home.module.css';

export default function Home() {
  const { user } = useAuthUser();
  const aggregate = useAggregateStat();
  const trackStats = useTrackStats();
  const registeredTracks = usePaceStore((s) => s.registeredTracks || []);
  const registerTrack = usePaceStore((s) => s.registerTrack);
  const notes = usePaceStore((s) => s.notes);
  const bookmarks = usePaceStore((s) => s.bookmarks);
  const solveLog = usePaceStore((s) => s.solveLog);
  const progress = usePaceStore((s) => s.progress);
  const planner = usePaceStore((s) => s.planner || {});
  const togglePlanItem = usePaceStore((s) => s.togglePlanItem);
  const streak = currentStreak(solveLog);

  const noteCount = Object.keys(notes).length;
  const bookmarkCount = Object.keys(bookmarks).length;

  const todayDate = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => {
    const y = todayDate.getFullYear();
    const m = String(todayDate.getMonth() + 1).padStart(2, '0');
    const day = String(todayDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, [todayDate]);

  const dayOfYear = useMemo(() => getDayOfYear(todayDate), [todayDate]);
  const dailyQuote = useMemo(() => getDailyQuote(todayDate), [todayDate]);
  const dateFormatted = useMemo(() => {
    return todayDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, [todayDate]);

  const todayItems = planner[todayKey] || [];
  const todaySolved = todayItems.filter((it) =>
    it.problemId ? progress[it.problemId] : it.completed
  ).length;

  const firstName = user?.displayName
    ? user.displayName.trim().split(/\s+/)[0]
    : user?.email
    ? user.email.split('@')[0]
    : null;

  const timeGreeting = useMemo(() => {
    const hour = todayDate.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, [todayDate]);

  const headingText = firstName
    ? `${timeGreeting}, ${firstName}.`
    : user
    ? `${timeGreeting}, Engineer.`
    : `${timeGreeting}. Welcome to Pace.`;

  const curatedMotivation = useMemo(() => {
    if (registeredTracks.length === 0) {
      return "You're at the starting line. Select your first curriculum below — Striver's A2Z, NeetCode 150, or Blind 75 — to build your roadmap, unlock personalized analytics, and start compounding your daily problem solving.";
    }

    const trackCountLabel = `${registeredTracks.length} track${registeredTracks.length === 1 ? '' : 's'}`;
    const solvedCount = aggregate.solved;
    const percentLabel = `${Math.round(aggregate.percent)}%`;

    if (todaySolved > 0) {
      return `Great momentum today — you've completed ${todaySolved} problem${todaySolved === 1 ? '' : 's'} today with an active ${streak}-day streak! You are at ${solvedCount} of ${aggregate.total} (${percentLabel}) across ${trackCountLabel}. Keep the compounding rhythm going.`;
    }

    if (streak > 0) {
      return `Your ${streak}-day streak is waiting on you today. You've solved ${solvedCount} problem${solvedCount === 1 ? '' : 's'} (${percentLabel}) across ${trackCountLabel}. Tackle a problem from your queue to keep the flame burning strong.`;
    }

    if (solvedCount > 0) {
      return `Welcome back! You've mastered ${solvedCount} problem${solvedCount === 1 ? '' : 's'} (${percentLabel}) across ${trackCountLabel}. Today is day 1 of your new streak — pick an algorithm and make it count.`;
    }

    return `Your curriculum is locked in with ${aggregate.total} curated problems across ${trackCountLabel}. Consistency beats intensity — pick your first problem below to ignite your Day 1 streak!`;
  }, [registeredTracks.length, aggregate.solved, aggregate.total, aggregate.percent, todaySolved, streak]);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <div className={styles.headerTop}>
          <span className={styles.dateBadge}>
            <CalendarDays size={13} />
            <span>{dateFormatted}</span>
            <span className={styles.badgeDot}>•</span>
            <span className={styles.badgeDay}>Day {dayOfYear} of 365</span>
          </span>
        </div>
        <h1 className={styles.heading}>{headingText}</h1>
        <p className={styles.sub}>{curatedMotivation}</p>
        <div className={styles.dailyInsightCard}>
          <div className={styles.insightHeader}>
            <Sparkles size={13} className={styles.insightIcon} />
            <span>Daily Focus</span>
            <span className={styles.badgeDot}>•</span>
            <span className={styles.insightTag}>{dailyQuote.tag}</span>
          </div>
          <p className={styles.insightQuote}>“{dailyQuote.quote}”</p>
          <span className={styles.insightAuthor}>— {dailyQuote.author}</span>
        </div>
      </header>

      <section className={styles.momentum}>
        <PaceRing
          percent={registeredTracks.length > 0 ? aggregate.percent : 0}
          value={registeredTracks.length > 0 ? `${Math.round(aggregate.percent)}%` : '0%'}
          label={registeredTracks.length > 0 ? 'enrolled tracks' : 'no tracks'}
        />
        <div className={styles.momentumStats}>
          <div className={styles.momentumFigure}>
            <span className={`${styles.figureValue} numeric`}>
              {registeredTracks.length > 0 ? aggregate.solved : 0}
            </span>
            <span className={styles.figureLabel}>
              {registeredTracks.length > 0
                ? `problems solved of ${aggregate.total} (${registeredTracks.length} track${
                    registeredTracks.length > 1 ? 's' : ''
                  })`
                : 'problems solved (register a track below to begin)'}
            </span>
          </div>
          <div className={styles.momentumRow}>
            <span className={styles.chip}>
              <Flame size={14} className={streak > 0 ? styles.chipIconActive : undefined} />
              {streak} day streak
            </span>
            <span className={styles.chip}>
              <NotebookPen size={14} />
              {noteCount} {noteCount === 1 ? 'note' : 'notes'}
            </span>
            <span className={styles.chip}>
              <Bookmark size={14} />
              {bookmarkCount} bookmarked
            </span>
          </div>
        </div>
      </section>

      {/* Today's Study Plan Section */}
      <section className={styles.plannerCard}>
        <div className={styles.plannerHeader}>
          <div className={styles.plannerTitleRow}>
            <CalendarDays size={18} color="var(--accent)" />
            <h2 className={styles.plannerTitle}>Today's Roadmap</h2>
            {todayItems.length > 0 && (
              <span className={styles.plannerBadge}>
                {todaySolved} / {todayItems.length} solved
              </span>
            )}
          </div>
          <Link to="/planner" className={styles.plannerLink}>
            <span>{todayItems.length > 0 ? 'Full Planner' : 'Open Planner'}</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {todayItems.length === 0 ? (
          <div className={styles.plannerEmptyPrompt}>
            <div className={styles.plannerEmptyText}>
              <span className={styles.plannerEmptyTitle}>
                No problems scheduled for today
              </span>
              <span className={styles.plannerEmptySub}>
                Plan your next topics or questions with Google Calendar sync.
              </span>
            </div>
            <Link to="/planner" className={styles.plannerCtaBtn}>
              <Sparkles size={14} color="var(--accent)" />
              <span>Plan Today</span>
            </Link>
          </div>
        ) : (
          <div className={styles.plannerProblemsList}>
            {todayItems.slice(0, 4).map((item) => {
              const isCompleted = item.problemId
                ? !!progress[item.problemId]
                : !!item.completed;
              return (
                <div key={item.id} className={styles.plannerProblemItem}>
                  <div className={styles.plannerItemLeft}>
                    <button
                      className={`${styles.plannerCheckBtn} ${
                        isCompleted ? styles.plannerCheckBtnCompleted : ''
                      }`}
                      onClick={() => togglePlanItem(todayKey, item.id)}
                      aria-label="Toggle completed"
                    >
                      {isCompleted && <Check size={13} style={{ strokeWidth: 3 }} />}
                    </button>
                    <span
                      className={`${styles.plannerItemTitle} ${
                        isCompleted ? styles.plannerItemCompleted : ''
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>
                  <span className={styles.plannerItemMeta}>
                    {item.topicTitle}
                  </span>
                </div>
              );
            })}
            {todayItems.length > 4 && (
              <div style={{ textAlign: 'right', paddingTop: '4px' }}>
                <Link
                  to="/planner"
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-tertiary)',
                    textDecoration: 'none',
                  }}
                >
                  +{todayItems.length - 4} more problems in Planner →
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Enrolled Curriculums Section */}
      {registeredTracks.length > 0 && (
        <section className={styles.curriculumSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle}>Enrolled Curriculums</h2>
              <span className={styles.sectionCountBadge}>
                {registeredTracks.length} of {TRACK_ORDER.length}
              </span>
            </div>
          </div>
          <div className={styles.trackList}>
            {registeredTracks.map((id) => {
              const meta = TRACK_META[id];
              const stat = trackStats[id];
              const started = stat.solved > 0;
              return (
                <Link key={id} to={`/track/${id}`} className={styles.trackRow}>
                  <div className={styles.trackInfo}>
                    <h2 className={styles.trackName}>{meta.label}</h2>
                    <p className={styles.trackSubtitle}>{meta.subtitle}</p>
                    <span className={styles.trackSource}>Source curriculum: {meta.source}</span>
                  </div>
                  <div className={styles.trackProgress}>
                    <span className={`${styles.trackFraction} mono`}>
                      {stat.solved}/{stat.total}
                    </span>
                    <Lane percent={stat.percent} color={meta.accent} />
                  </div>
                  <span className={styles.trackCta}>
                    {started ? 'Continue' : 'Start'}
                    <ArrowRight size={15} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Available Curriculums Section */}
      {TRACK_ORDER.some((id) => !registeredTracks.includes(id)) && (
        <section className={styles.curriculumSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle}>
                {registeredTracks.length === 0 ? 'Choose Your Curriculum' : 'Available Curriculums'}
              </h2>
              <span className={styles.sectionCountBadge}>
                {TRACK_ORDER.length - registeredTracks.length} available
              </span>
            </div>
          </div>
          <p className={styles.sectionDesc}>
            Register for a track to unlock its problem list, video solutions, AI tutoring, and personal analytics.
          </p>

          {registeredTracks.length === 0 && (
            <div className={styles.emptyCurriculumBanner}>
              <div className={styles.emptyCurriculumIcon}>
                <Sparkles size={20} />
              </div>
              <div className={styles.emptyCurriculumText}>
                <div className={styles.emptyCurriculumTitle}>Get Started with a Track</div>
                <div className={styles.emptyCurriculumSub}>
                  Select one or more tracks below to curate your daily questions, roadmap, and analytics.
                </div>
              </div>
            </div>
          )}

          <div>
            {TRACK_ORDER.filter((id) => !registeredTracks.includes(id)).map((id) => {
              const meta = TRACK_META[id];
              const stat = trackStats[id];
              return (
                <div key={id} className={styles.unregisteredCard}>
                  <div className={styles.unregisteredInfo}>
                    <div className={styles.unregisteredTitleRow}>
                      <span className={styles.unregisteredTitle}>{meta.label}</span>
                      <span className={styles.unregisteredTotal}>{stat.total} problems</span>
                    </div>
                    <p className={styles.unregisteredDesc}>{meta.subtitle}</p>
                    <span className={styles.unregisteredSource}>Source: {meta.source}</span>
                  </div>
                  <button
                    className={styles.registerActionBtn}
                    onClick={(e) => {
                      e.preventDefault();
                      registerTrack(id);
                    }}
                  >
                    + Register
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
