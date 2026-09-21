import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, CornerDownLeft } from 'lucide-react';
import { getTrack, TRACK_META, TRACK_ORDER } from '../data';
import { usePaceStore } from '../state/store';
import styles from './SearchPalette.module.css';

interface Hit {
  id: string;
  title: string;
  trackId: (typeof TRACK_ORDER)[number];
  groupId: string;
  difficulty: string;
}

export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const progress = usePaceStore((s) => s.progress);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allHits = useMemo<Hit[]>(() => {
    const hits: Hit[] = [];
    for (const trackId of TRACK_ORDER) {
      const track = getTrack(trackId);
      for (const group of track.groups) {
        for (const p of group.problems) {
          hits.push({ id: p.id, title: p.title, trackId, groupId: group.id, difficulty: p.difficulty });
        }
      }
    }
    return hits;
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allHits.filter((h) => h.title.toLowerCase().includes(q)).slice(0, 40);
  }, [query, allHits]);

  useEffect(() => setActiveIndex(0), [query]);

  function go(hit: Hit) {
    navigate(`/track/${hit.trackId}?highlight=${encodeURIComponent(hit.id)}`);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && results[activeIndex]) {
      go(results[activeIndex]);
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.inputRow}>
          <Search size={16} className={styles.searchIcon} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search across every track..."
            className={styles.input}
          />
          <button className={styles.closeButton} onClick={onClose} aria-label="Close search">
            <X size={16} />
          </button>
        </div>
        {query.trim() && (
          <ul className={styles.results}>
            {results.length === 0 && <li className={styles.empty}>No problems match "{query}".</li>}
            {results.map((hit, i) => (
              <li key={`${hit.trackId}-${hit.id}`}>
                <button
                  className={`${styles.result} ${i === activeIndex ? styles.resultActive : ''}`}
                  onClick={() => go(hit)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className={progress[hit.id] ? styles.solvedDot : styles.openDot} />
                  <span className={styles.resultTitle}>{hit.title}</span>
                  <span className={styles.resultTrack}>{TRACK_META[hit.trackId].shortLabel}</span>
                  {i === activeIndex && <CornerDownLeft size={13} className={styles.enterHint} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
