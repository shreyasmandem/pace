import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { RotateCcw, Search } from 'lucide-react';
import { getTopicNote, getTrack, TRACK_META } from '../data';
import { useDifficultyBreakdown, useTrackStats } from '../hooks/useTrackStats';
import { usePaceStore } from '../state/store';
import type { TrackId } from '../types';
import Lane from '../components/Lane';
import TopicSection from '../components/TopicSection';
import NotesDrawer from '../components/NotesDrawer';
import ConfirmDialog from '../components/ConfirmDialog';
import styles from './TrackSheet.module.css';

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];
const STATUSES = ['All', 'Solved', 'Unsolved'];

export default function TrackSheet() {
  const { trackId } = useParams<{ trackId: string }>();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [status, setStatus] = useState('All');
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const progress = usePaceStore((s) => s.progress);
  const resetTrack = usePaceStore((s) => s.resetTrack);
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

  const problemsForTitle = notesFor
    ? track.groups.flatMap((g) => g.problems).find((p) => p.id === notesFor)
    : null;

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
        <button className={styles.resetButton} onClick={() => setConfirmingReset(true)}>
          <RotateCcw size={14} />
          Reset track
        </button>
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
            onOpenNotes={setNotesFor}
          />
        ))}
      </div>

      {notesFor && problemsForTitle && (
        <NotesDrawer problemId={notesFor} problemTitle={problemsForTitle.title} onClose={() => setNotesFor(null)} />
      )}

      {confirmingReset && (
        <ConfirmDialog
          title={`Reset ${meta.shortLabel}?`}
          body="This clears progress, notes, and bookmarks for every problem in this track. This can't be undone."
          confirmLabel="Reset track"
          onConfirm={() => {
            resetTrack(allProblemIds);
            setConfirmingReset(false);
          }}
          onCancel={() => setConfirmingReset(false)}
        />
      )}
    </div>
  );
}
