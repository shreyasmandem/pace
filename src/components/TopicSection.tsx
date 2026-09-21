import { useEffect, useRef, useState } from 'react';
import { ChevronRight, PlayCircle } from 'lucide-react';
import type { TopicGroup } from '../types';
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
  onOpenNotes: (problemId: string) => void;
}

export default function TopicSection({
  group,
  index,
  note,
  accent,
  defaultOpen = false,
  highlightId,
  onOpenNotes,
}: TopicSectionProps) {
  const [open, setOpen] = useState(defaultOpen || !!highlightId);
  const progress = usePaceStore((s) => s.progress);
  const highlightRef = useRef<HTMLDivElement>(null);

  const solved = group.problems.reduce((n, p) => n + (progress[p.id] ? 1 : 0), 0);
  const percent = group.problems.length ? (solved / group.problems.length) * 100 : 0;
  const complete = solved === group.problems.length && group.problems.length > 0;

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
      <button className={styles.header} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronRight size={16} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
        <span className={styles.topicIndex}>{String(index + 1).padStart(2, '0')}</span>
        <span className={styles.titleBlock}>
          <span className={styles.title}>{group.title}</span>
          {open && note && <span className={styles.note}>{note}</span>}
        </span>
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
        <span className={`${styles.fraction} mono ${complete ? styles.fractionDone : ''}`}>
          {solved}/{group.problems.length}
        </span>
      </button>
      <Lane percent={percent} color={accent} size="sm" />

      {open && (
        <div className={styles.problems}>
          {group.problems.map((p, i) => (
            <ProblemRow
              key={p.id}
              problem={p}
              index={i}
              ref={p.id === highlightId ? highlightRef : undefined}
              highlighted={p.id === highlightId}
              onOpenNotes={onOpenNotes}
            />
          ))}
        </div>
      )}
    </section>
  );
}
