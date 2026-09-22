import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, CornerDownLeft, Building2 } from 'lucide-react';
import { getTrack, TRACK_META, TRACK_ORDER, COMPANIES } from '../data';
import { usePaceStore } from '../state/store';
import styles from './SearchPalette.module.css';

interface ProblemHit {
  type: 'problem';
  id: string;
  title: string;
  trackId: (typeof TRACK_ORDER)[number];
  groupId: string;
  difficulty: string;
}

interface CompanyHit {
  type: 'company';
  id: string;
  title: string;
  total: number;
}

type Hit = ProblemHit | CompanyHit;

export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const progress = usePaceStore((s) => s.progress);
  const registeredTracks = usePaceStore((s) => s.registeredTracks || []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allHits = useMemo<ProblemHit[]>(() => {
    const hits: ProblemHit[] = [];
    for (const trackId of registeredTracks) {
      const track = getTrack(trackId);
      if (!track) continue;
      for (const group of track.groups) {
        for (const p of group.problems) {
          hits.push({
            type: 'problem',
            id: p.id,
            title: p.title,
            trackId,
            groupId: group.id,
            difficulty: p.difficulty,
          });
        }
      }
    }
    return hits;
  }, [registeredTracks]);

  const results = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // Check company matches (companies remain universal)
    const matchedCompanies: CompanyHit[] = COMPANIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.includes(q)
    )
      .slice(0, 5)
      .map((c) => ({
        type: 'company',
        id: c.id,
        title: c.name,
        total: c.total,
      }));

    const matchedProblems = allHits.filter((h) => h.title.toLowerCase().includes(q)).slice(0, 35);

    return [...matchedCompanies, ...matchedProblems];
  }, [query, allHits]);

  useEffect(() => setActiveIndex(0), [query]);

  function go(hit: Hit) {
    if (hit.type === 'company') {
      navigate(`/company/${hit.id}`);
    } else {
      navigate(`/track/${hit.trackId}?highlight=${encodeURIComponent(hit.id)}`);
    }
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
            placeholder={
              registeredTracks.length === 0
                ? 'Search companies (register for a track to search problems)...'
                : 'Search across registered tracks & companies...'
            }
            className={styles.input}
          />
          <button className={styles.closeButton} onClick={onClose} aria-label="Close search">
            <X size={16} />
          </button>
        </div>
        {query.trim() && (
          <ul className={styles.results}>
            {results.length === 0 && (
              <li className={styles.empty}>
                No matches for "{query}".
                {registeredTracks.length === 0 && ' (No tracks currently enrolled)'}
              </li>
            )}
            {results.map((hit, i) => {
              const key = hit.type === 'company' ? `company-${hit.id}` : `${hit.trackId}-${hit.id}`;
              return (
                <li key={key}>
                  <button
                    className={`${styles.result} ${i === activeIndex ? styles.resultActive : ''}`}
                    onClick={() => go(hit)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    {hit.type === 'company' ? (
                      <>
                        <Building2 size={13} color="var(--accent)" style={{ flex: 'none' }} />
                        <span className={styles.resultTitle}>{hit.title}</span>
                        <span className={`${styles.resultTrack} mono`}>{hit.total} problems</span>
                      </>
                    ) : (
                      <>
                        <span className={progress[hit.id] ? styles.solvedDot : styles.openDot} />
                        <span className={styles.resultTitle}>{hit.title}</span>
                        <span className={styles.resultTrack}>{TRACK_META[hit.trackId].shortLabel}</span>
                      </>
                    )}
                    {i === activeIndex && <CornerDownLeft size={13} className={styles.enterHint} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
