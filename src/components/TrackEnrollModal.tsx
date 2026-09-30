import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Check, Compass, ArrowRight, Trash2 } from 'lucide-react';
import { TRACK_ORDER, TRACK_META, getTrack, getAllProblems } from '../data';
import { usePaceStore } from '../state/store';
import type { TrackId } from '../types';
import ConfirmDialog from './ConfirmDialog';
import Lane from './Lane';
import styles from './TrackEnrollModal.module.css';

interface TrackEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrackEnrollModal({ isOpen, onClose }: TrackEnrollModalProps) {
  const [mounted, setMounted] = useState(false);
  const [unregisteringTrackId, setUnregisteringTrackId] = useState<TrackId | null>(null);

  const registeredTracks = usePaceStore((s) => s.registeredTracks || []);
  const registerTrack = usePaceStore((s) => s.registerTrack);
  const unregisterTrack = usePaceStore((s) => s.unregisterTrack);
  const progress = usePaceStore((s) => s.progress);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !unregisteringTrackId) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, unregisteringTrackId]);

  if (!mounted || !isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIconWrapper}>
              <Compass size={20} />
            </div>
            <div>
              <div className={styles.headerTitleRow}>
                <h3 className={styles.title}>Explore Tracks</h3>
                <span className={styles.counterBadge}>
                  {registeredTracks.length} / {TRACK_ORDER.length} Enrolled
                </span>
              </div>
              <p className={styles.subtitle}>
                Register for structured curriculums to unlock guided problem roadmaps, AI tutoring, and personal analytics.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Track List */}
        <div className={styles.trackList}>
          {TRACK_ORDER.map((id) => {
            const meta = TRACK_META[id];
            const track = getTrack(id);
            const total = track.groups.reduce((acc, g) => acc + g.problems.length, 0);
            const isEnrolled = registeredTracks.includes(id);

            // Calculate solved progress
            const allProblems = getAllProblems(id);
            const solved = allProblems.filter((p) => progress[p.id]).length;
            const percent = total > 0 ? (solved / total) * 100 : 0;

            return (
              <div
                key={id}
                className={`${styles.trackCard} ${isEnrolled ? styles.trackCardEnrolled : ''}`}
              >
                <div className={styles.trackCardTop}>
                  <div className={styles.trackCardInfo}>
                    <div className={styles.trackNameRow}>
                      <span
                        className={styles.trackTag}
                        style={{
                          background: `${meta.accent}20`,
                          color: meta.accent,
                          border: `1px solid ${meta.accent}50`,
                        }}
                      >
                        {meta.shortLabel}
                      </span>
                      <span className={styles.trackName}>{meta.label}</span>
                    </div>

                    <p className={styles.trackSubtitle}>{meta.subtitle}</p>

                    <div className={styles.trackMetaRow}>
                      <span className={styles.trackMetaItem}>{total} problems</span>
                      <span className={styles.trackDotDivider}>•</span>
                      <span className={styles.trackMetaItem}>Source: {meta.source}</span>
                    </div>
                  </div>

                  <div className={styles.trackCardActions}>
                    {isEnrolled ? (
                      <>
                        <span className={styles.enrolledBadge}>
                          <Check size={12} style={{ strokeWidth: 3 }} /> Enrolled
                        </span>
                        <Link
                          to={`/track/${id}`}
                          className={styles.openTrackLink}
                          onClick={onClose}
                          title="Open this track"
                        >
                          Open <ArrowRight size={12} />
                        </Link>
                        <button
                          type="button"
                          className={styles.unregisterBtn}
                          onClick={() => setUnregisteringTrackId(id)}
                          title="Unregister from track"
                          aria-label={`Unregister from ${meta.label}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.registerBtn}
                        onClick={() => registerTrack(id)}
                        title="Register for this track"
                      >
                        + Register
                      </button>
                    )}
                  </div>
                </div>

                {isEnrolled && (
                  <div className={styles.trackProgressContainer}>
                    <div className={styles.trackProgressLabelRow}>
                      <span>Solved Progress</span>
                      <span className="mono">
                        {solved} / {total} ({Math.round(percent)}%)
                      </span>
                    </div>
                    <Lane percent={percent} color={meta.accent} size="sm" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Link
            to="/settings"
            className={styles.settingsHint}
            onClick={onClose}
          >
            Manage tracks in Settings →
          </Link>
          <button type="button" className={styles.doneBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      {unregisteringTrackId && (
        <ConfirmDialog
          title={`Unregister from ${TRACK_META[unregisteringTrackId].label}?`}
          body={`Warning: All your solved progress, bookmarks, and personal notes in ${TRACK_META[unregisteringTrackId].label} will be permanently deleted and reset to 0. Are you sure you want to unregister?`}
          confirmLabel="Unregister & Delete Progress"
          onConfirm={() => {
            unregisterTrack(unregisteringTrackId);
            setUnregisteringTrackId(null);
          }}
          onCancel={() => setUnregisteringTrackId(null)}
        />
      )}
    </div>,
    document.body
  );
}
