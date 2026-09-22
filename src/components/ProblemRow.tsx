import { forwardRef } from 'react';
import { Bookmark, Check, Sparkles } from 'lucide-react';
import type { Problem } from '../types';
import { usePaceStore } from '../state/store';
import ResourceLinks from './ResourceLinks';
import styles from './ProblemRow.module.css';

interface ProblemRowProps {
  problem: Problem;
  index: number;
  highlighted?: boolean;
  onOpenNotes?: (problemId: string) => void;
  onOpenTutor?: (problemId: string) => void;
}

const DIFFICULTY_CLASS: Record<string, string> = {
  Easy: styles.easy,
  Medium: styles.medium,
  Hard: styles.hard,
  Practice: styles.practice,
};

const ProblemRow = forwardRef<HTMLDivElement, ProblemRowProps>(function ProblemRow(
  { problem, index, highlighted, onOpenNotes, onOpenTutor },
  ref
) {
  const solved = usePaceStore((s) => !!s.progress[problem.id]);
  const toggleProblem = usePaceStore((s) => s.toggleProblem);
  const hasChat = usePaceStore((s) => !!s.tutorChats?.[problem.id]?.length);
  const hasNote = usePaceStore((s) => !!s.notes?.[problem.id]?.trim());
  const bookmarked = usePaceStore((s) => !!s.bookmarks[problem.id]);
  const toggleBookmark = usePaceStore((s) => s.toggleBookmark);

  const handleTutorClick = () => {
    if (onOpenTutor) {
      onOpenTutor(problem.id);
    } else if (onOpenNotes) {
      onOpenNotes(problem.id);
    }
  };

  return (
    <div ref={ref} className={`${styles.row} ${highlighted ? styles.highlighted : ''}`}>
      <button
        className={`${styles.checkbox} ${solved ? styles.checked : ''}`}
        onClick={() => toggleProblem(problem.id)}
        aria-pressed={solved}
        aria-label={solved ? `Mark ${problem.title} as not solved` : `Mark ${problem.title} as solved`}
      >
        {solved && <Check size={12} strokeWidth={3} />}
      </button>

      <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>

      <span className={`${styles.title} ${solved ? styles.titleSolved : ''}`}>{problem.title}</span>

      <span className={`${styles.difficulty} ${DIFFICULTY_CLASS[problem.difficulty] ?? styles.practice}`}>
        {problem.difficulty}
      </span>

      <ResourceLinks links={problem.links} />

      <button
        className={`${styles.iconButton} ${styles.tutorBtn} ${hasChat || hasNote ? styles.tutorActive : ''}`}
        onClick={handleTutorClick}
        aria-label="Ask Pacer"
        title="Ask Pacer"
      >
        <Sparkles size={13} />
      </button>

      <button
        className={`${styles.iconButton} ${bookmarked ? styles.iconActive : ''}`}
        onClick={() => toggleBookmark(problem.id)}
        aria-pressed={bookmarked}
        aria-label="Bookmark"
        title="Bookmark"
      >
        <Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
});

export default ProblemRow;
