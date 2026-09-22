import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bookmark,
  Flame,
  NotebookPen,
  Building2,
  CalendarDays,
  Check,
  Sparkles,
} from 'lucide-react';
import { TRACK_META, TRACK_ORDER, getFeaturedCompanies } from '../data';
import { useAggregateStat, useTrackStats } from '../hooks/useTrackStats';
import { usePaceStore, currentStreak } from '../state/store';
import PaceRing from '../components/PaceRing';
import Lane from '../components/Lane';
import styles from './Home.module.css';

export default function Home() {
  const aggregate = useAggregateStat();
  const trackStats = useTrackStats();
  const notes = usePaceStore((s) => s.notes);
  const bookmarks = usePaceStore((s) => s.bookmarks);
  const solveLog = usePaceStore((s) => s.solveLog);
  const progress = usePaceStore((s) => s.progress);
  const planner = usePaceStore((s) => s.planner || {});
  const togglePlanItem = usePaceStore((s) => s.togglePlanItem);
  const streak = currentStreak(solveLog);

  const noteCount = Object.keys(notes).length;
  const bookmarkCount = Object.keys(bookmarks).length;
  const featuredCompanies = getFeaturedCompanies().slice(0, 12);

  const todayKey = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const todayItems = planner[todayKey] || [];
  const todaySolved = todayItems.filter((it) =>
    it.problemId ? progress[it.problemId] : it.completed
  ).length;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.heading}>Every DSA sheet worth doing, in one place.</h1>
        <p className={styles.sub}>
          Striver's A2Z, NeetCode 150, NeetCode 250, Blind 75, and 500+ Company Question Sets — real
          links, real lecture videos, your own notes, tracked for free.
        </p>
      </header>

      <section className={styles.momentum}>
        <PaceRing percent={aggregate.percent} value={`${Math.round(aggregate.percent)}%`} label="of every track" />
        <div className={styles.momentumStats}>
          <div className={styles.momentumFigure}>
            <span className={`${styles.figureValue} numeric`}>{aggregate.solved}</span>
            <span className={styles.figureLabel}>problems solved of {aggregate.total}</span>
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
                Plan your next topics or auto-pace questions with Google Calendar sync.
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

      <section className={styles.trackList}>
        {TRACK_ORDER.map((id) => {
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
      </section>

      <section className={styles.companySection}>
        <div className={styles.companyHeader}>
          <div className={styles.companyTitleRow}>
            <Building2 size={18} color="var(--accent)" />
            <h2 className={styles.companyTitle}>Company-Wise DSA Sheets</h2>
            <span className={styles.companyBadge}>500+ Companies</span>
          </div>
        </div>
        <p className={styles.companySub}>
          Target your interview prep with real problem frequencies asked by FAANG, Tier-1 tech, and
          top Indian startups.
        </p>
        <div className={styles.companyGrid}>
          {featuredCompanies.map((comp) => (
            <Link key={comp.id} to={`/company/${comp.id}`} className={styles.companyCard}>
              <span className={styles.companyCardName}>{comp.name}</span>
              <span className={`${styles.companyCardCount} mono`}>{comp.total} questions</span>
            </Link>
          ))}
        </div>
        <div className={styles.companyCtaRow}>
          <Link to="/companies" className={styles.companyCta}>
            Browse all 500+ companies <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
