import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Flag, PlayCircle, Sparkles } from 'lucide-react';
import type { Problem, TopicGroup } from '../types';
import { usePaceStore } from '../state/store';
import ProblemRow from './ProblemRow';
import Lane from './Lane';
import styles from './TopicSection.module.css';

interface TopicSectionProps {
  group: TopicGroup;
  index: number;
  note: string | null;
  accent: string;
  defaultOpen?: boolean;
  highlightId?: string | null;
  onOpenNotes?: (problemId: string) => void;
  onOpenTutor?: (session: {
    topicId: string;
    topicTitle: string;
    problems: Problem[];
    currentProblem?: Problem | null;
  }) => void;
}

export default function TopicSection({
  group,
  index,
  note,
  accent,
  defaultOpen = false,
  highlightId,
  onOpenNotes,
  onOpenTutor,
}: TopicSectionProps) {
  const [open, setOpen] = useState(defaultOpen || !!highlightId);
  const progress = usePaceStore((s) => s.progress);
  const highlightRef = useRef<HTMLDivElement>(null);

  const solved = group.problems.reduce((n, p) => n + (progress[p.id] ? 1 : 0), 0);
  const percent = group.problems.length ? (solved / group.problems.length) * 100 : 0;
  const complete = solved === group.problems.length && group.problems.length > 0;

  // Stamp animation only when the topic is finished while you're looking at it, not on load.
  const [justCleared, setJustCleared] = useState(false);
  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) {
      setJustCleared(true);
      const t = setTimeout(() => setJustCleared(false), 1200);
      wasComplete.current = complete;
      return () => clearTimeout(t);
    }
    wasComplete.current = complete;
  }, [complete]);

  useEffect(() => {
    if (highlightId && group.problems.some((p) => p.id === highlightId)) {
      setOpen(true);
      const t = setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
      return () => clearTimeout(t);
    }
  }, [highlightId, group.problems]);

  const handleOpenTutorForTopic = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenTutor) {
      onOpenTutor({
        topicId: group.id,
        topicTitle: group.title,
        problems: group.problems,
        currentProblem: null,
      });
    } else if (onOpenNotes && group.problems[0]) {
      onOpenNotes(group.problems[0].id);
    }
  };

  return (
    <section className={styles.section}>
      <div
        className={styles.header}
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        aria-expanded={open}
      >
        <ChevronRight size={16} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
        <span className={styles.topicIndex}>{String(index + 1).padStart(2, '0')}</span>
        <span className={styles.titleBlock}>
          <span className={styles.title}>{group.title}</span>
          {note && (
            <span className={`${styles.note} ${open ? styles.noteVisible : ''}`}>{note}</span>
          )}
        </span>
        <button
          className={styles.tutorBtn}
          onClick={handleOpenTutorForTopic}
          title={`Ask Pacer about ${group.title}`}
          aria-label={`Ask Pacer about ${group.title}`}
        >
          <Sparkles size={13} className={styles.tutorSparkle} />
          <span>Pacer</span>
        </button>
        {group.videoUrl && (
          <a
            href={group.videoUrl}
            target="_blank"
            rel="noreferrer"
            className={styles.videoLink}
            onClick={(e) => e.stopPropagation()}
          >
            <PlayCircle size={13} />
            Lecture
          </a>
        )}
        {complete ? (
          <span className={`${styles.cleared} ${justCleared ? styles.clearedStamp : ''}`}>
            <Flag size={12} />
            Cleared
          </span>
        ) : (
          <span className={`${styles.fraction} mono`}>
            {solved}/{group.problems.length}
          </span>
        )}
      </div>
      <Lane percent={percent} color={accent} size="sm" />

      <div className={`${styles.accordionWrapper} ${open ? styles.accordionWrapperOpen : ''}`}>
        <div className={styles.accordionContent}>
          <div className={styles.problems}>
            {group.problems.map((p, i) => (
              <ProblemRow
                key={p.id}
                problem={p}
                index={i}
                ref={p.id === highlightId ? highlightRef : undefined}
                highlighted={p.id === highlightId}
                onOpenNotes={onOpenNotes}
                onOpenTutor={() => {
                  if (onOpenTutor) {
                    onOpenTutor({
                      topicId: group.id,
                      topicTitle: group.title,
                      problems: group.problems,
                      currentProblem: p,
                    });
                  } else if (onOpenNotes) {
                    onOpenNotes(p.id);
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
