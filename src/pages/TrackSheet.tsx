import { useCallback, useMemo, useState } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { Check, Lock, Search, Sparkles } from 'lucide-react';
import { getTopicNote, getTrack, TRACK_META } from '../data';
import { useDifficultyBreakdown, useTrackStats } from '../hooks/useTrackStats';
import { usePaceStore } from '../state/store';
import type { TrackId } from '../types';
import Lane from '../components/Lane';
import TopicSection from '../components/TopicSection';
import AITutorDrawer from '../components/AITutorDrawer';
import type { Problem } from '../types';
import styles from './TrackSheet.module.css';

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];
const STATUSES = ['All', 'Solved', 'Unsolved'];

interface TutorSessionState {
  topicKey: string;
  topicId: string;
  topicTitle: string;
  problems: Problem[];
  currentProblem?: Problem | null;
}

export default function TrackSheet() {
  const { trackId } = useParams<{ trackId: string }>();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [status, setStatus] = useState('All');
  const [tutorSession, setTutorSession] = useState<TutorSessionState | null>(null);

  const handleCloseTutor = useCallback(() => {
    setTutorSession(null);
  }, []);

  const progress = usePaceStore((s) => s.progress);
  const registeredTracks = usePaceStore((s) => s.registeredTracks || []);
  const registerTrack = usePaceStore((s) => s.registerTrack);
  const stats = useTrackStats();
  const safeId = (trackId && trackId in TRACK_META ? trackId : 'a2z') as TrackId;
  const breakdown = useDifficultyBreakdown(safeId);

  if (!trackId || !(trackId in TRACK_META)) {
    return <Navigate to="/" replace />;
  }
  const id = trackId as TrackId;
  const meta = TRACK_META[id];
  const track = getTrack(id);
  const stat = stats[id];
  const isEnrolled = registeredTracks.includes(id);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return track.groups
      .map((group) => {
        const problems = group.problems.filter((p) => {
          if (q && !p.title.toLowerCase().includes(q)) return false;
          if (difficulty !== 'All' && p.difficulty !== difficulty) return false;
          const solved = !!progress[p.id];
          if (status === 'Solved' && !solved) return false;
          if (status === 'Unsolved' && solved) return false;
          return true;
        });
        return { ...group, problems };
      })
      .filter((g) => g.problems.length > 0);
  }, [track.groups, query, difficulty, status, progress]);

  const allProblemIds = useMemo(() => track.groups.flatMap((g) => g.problems.map((p) => p.id)), [track.groups]);

  if (!isEnrolled) {
    return (
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>{meta.label}</h1>
            <p className={styles.subtitle}>{meta.subtitle}</p>
            <a href={meta.sourceUrl} target="_blank" rel="noreferrer" className={styles.sourceLink}>
              Source curriculum: {meta.source} ↗
            </a>
          </div>
        </header>

        {/* Enrollment / Registration Gate */}
        <div className={styles.gateContainer}>
          <div className={styles.gateIconWrapper}>
            <Lock size={24} />
          </div>
          <h2 className={styles.gateTitle}>Register to Unlock {meta.shortLabel}</h2>
          <p className={styles.gateDesc}>
            You haven't registered for this curriculum yet. Register now to unlock problem checklists,
            step-by-step topics, solution bookmarks, personal notes, Pacer AI mentor integration,
            and personalized progress analytics.
          </p>

          <div className={styles.gateFeatures}>
            <div className={styles.gateFeatureItem}>
              <span className={styles.gateFeatureLabel}>Curated Problems</span>
              <span className={styles.gateFeatureVal}>{stat.total} Questions</span>
            </div>
            <div className={styles.gateFeatureItem}>
              <span className={styles.gateFeatureLabel}>Core Topics</span>
              <span className={styles.gateFeatureVal}>{track.groups.length} Patterns</span>
            </div>
            <div className={styles.gateFeatureItem}>
              <span className={styles.gateFeatureLabel}>Curriculum Source</span>
              <span className={styles.gateFeatureVal}>{meta.source}</span>
            </div>
          </div>

          <button className={styles.registerCtaBtn} onClick={() => registerTrack(id)}>
            <Sparkles size={16} />
            <span>Register for {meta.shortLabel}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <div className={styles.registeredBadge}>
            <Check size={12} />
            <span>Registered Track</span>
          </div>
          <h1 className={styles.title}>{meta.label}</h1>
          <p className={styles.subtitle}>{meta.subtitle}</p>
          <a href={meta.sourceUrl} target="_blank" rel="noreferrer" className={styles.sourceLink}>
            Source curriculum: {meta.source} ↗
          </a>
        </div>
        <div className={styles.heroStat}>
          <span className={`${styles.heroFigure} numeric`}>{Math.round(stat.percent)}%</span>
          <span className={styles.heroFraction}>
            <span className="numeric">{stat.solved}</span> of <span className="numeric">{stat.total}</span> solved
          </span>
          <Lane percent={stat.percent} color={meta.accent} size="lg" />
          <div className={styles.difficultyBreakdown}>
            <span className={styles.diffEasy}>
              Easy <span className="mono">{breakdown.easy.solved}/{breakdown.easy.total}</span>
            </span>
            <span className={styles.diffMedium}>
              Medium <span className="mono">{breakdown.medium.solved}/{breakdown.medium.total}</span>
            </span>
            <span className={styles.diffHard}>
              Hard <span className="mono">{breakdown.hard.solved}/{breakdown.hard.total}</span>
            </span>
          </div>
        </div>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this track..."
          />
        </label>
        <div className={styles.chips}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              className={`${styles.chip} ${difficulty === d ? styles.chipActive : ''}`}
              onClick={() => setDifficulty(d)}
            >
              {d}
            </button>
          ))}
        </div>
        <div className={styles.chips}>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`${styles.chip} ${status === s ? styles.chipActive : ''}`}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.groups}>
        {filteredGroups.length === 0 && (
          <p className={styles.empty}>No problems match these filters.</p>
        )}
        {filteredGroups.map((group, i) => (
          <TopicSection
            key={group.id}
            group={group}
            index={i}
            accent={meta.accent}
            note={getTopicNote(id, group.id, group.title)}
            defaultOpen={i === 0 && !query && difficulty === 'All' && status === 'All'}
            highlightId={highlightId}
            onOpenTutor={(session) => {
              setTutorSession({
                topicKey: `${safeId}_${session.topicId}`,
                topicId: session.topicId,
                topicTitle: session.topicTitle,
                problems: session.problems,
                currentProblem: session.currentProblem,
              });
            }}
            onOpenNotes={(problemId) => {
              const prob = group.problems.find((p) => p.id === problemId);
              setTutorSession({
                topicKey: `${safeId}_${group.id}`,
                topicId: group.id,
                topicTitle: group.title,
                problems: group.problems,
                currentProblem: prob || null,
              });
            }}
          />
        ))}
      </div>

      {tutorSession && (
        <AITutorDrawer
          topicKey={tutorSession.topicKey}
          topicTitle={tutorSession.topicTitle}
          trackTitle={meta.label}
          problems={tutorSession.problems}
          currentProblem={tutorSession.currentProblem}
          onClose={handleCloseTutor}
        />
      )}
    </div>
  );
}
