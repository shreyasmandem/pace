import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { usePaceStore } from '../state/store';
import styles from './NotesDrawer.module.css';

export default function NotesDrawer({
  problemId,
  problemTitle,
  onClose,
}: {
  problemId: string;
  problemTitle: string;
  onClose: () => void;
}) {
  const note = usePaceStore((s) => s.notes[problemId] ?? '');
  const setNote = usePaceStore((s) => s.setNote);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h3 className={styles.title}>{problemTitle}</h3>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={note}
          onChange={(e) => setNote(problemId, e.target.value)}
          placeholder="Pattern, edge cases, the moment it clicked, a link to your own solution..."
        />
        <div className={styles.footer}>Saved automatically to this browser.</div>
      </div>
    </div>
  );
}
