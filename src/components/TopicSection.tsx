import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Flag, Minus } from 'lucide-react';
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
  const setManyProblems = usePaceStore((s) => s.setManyProblems);
  const highlightRef = useRef<HTMLDivElement>(null);

  const solved = group.problems.reduce((n, p) => n + (progress[p.id] ? 1 : 0), 0);
  const percent = group.problems.length ? (solved / group.problems.length) * 100 : 0;
  const complete = solved === group.problems.length && group.problems.length > 0;
  const partial = solved > 0 && !complete;

  const handleToggleAll = () => {
    const ids = group.problems.map((p) => p.id);
    const nextValue = !complete;
    setManyProblems(ids, nextValue);
  };

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
        <div className={styles.headerMeta}>
          {open && (
            <button
              type="button"
              className={`${styles.checkAllBtn} ${complete ? styles.checkAllBtnComplete : partial ? styles.checkAllBtnPartial : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleAll();
              }}
              title={complete ? 'Uncheck all problems in this topic' : 'Check all problems in this topic'}
              aria-label={complete ? 'Uncheck all problems' : 'Check all problems'}
            >
              <span className={`${styles.checkAllBox} ${complete ? styles.checkAllBoxActive : partial ? styles.checkAllBoxPartial : ''}`}>
                {complete ? <Check size={11} strokeWidth={3} /> : partial ? <Minus size={11} strokeWidth={3} /> : null}
              </span>
              <span className={styles.checkAllLabel}>{complete ? 'Uncheck all' : 'Check all'}</span>
            </button>
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
      </div>
      <Lane percent={percent} color={accent} size="sm" />

      <div className={`${styles.accordionWrapper} ${open ? styles.accordionWrapperOpen : ''}`}>
        <div className={styles.accordionContent}>
          <div className={styles.problems}>
            <div className={styles.table}>
              <div className={styles.tableHeader}>
                <span className={styles.thCheck}>
                  <button
                    type="button"
                    className={`${styles.thCheckBtn} ${complete ? styles.thCheckBtnActive : partial ? styles.thCheckBtnPartial : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleAll();
                    }}
                    title={complete ? 'Uncheck all problems' : 'Check all problems'}
                    aria-label={complete ? 'Uncheck all problems' : 'Check all problems'}
                  >
                    {complete ? <Check size={12} strokeWidth={3} /> : partial ? <Minus size={12} strokeWidth={3} /> : null}
                  </button>
                </span>
                <span className={styles.thIndex}>#</span>
                <span className={styles.thTitle}>Problem Title</span>
                <span className={styles.thDiff}>Difficulty</span>
                <span className={styles.thActions}>Links</span>
              </div>
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
      </div>
    </section>
  );
}
