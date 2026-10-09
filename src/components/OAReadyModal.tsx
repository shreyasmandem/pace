import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MessageSquare,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { COMPANIES, getCompanyMeta } from '../data';
import { usePaceStore } from '../state/store';
import type { CustomTrack, OAFocusMode, Problem } from '../types';
import { buildOAReadyTrack } from '../lib/oaReady';
import TopicSection from './TopicSection';
import ConfirmDialog from './ConfirmDialog';
import styles from './OAReadyModal.module.css';

interface OAReadyModalProps {
  initialCompanyId: string;
  onClose: () => void;
  onOpenGeneralChat?: () => void;
  onOpenProblemTutor?: (problem: Problem, sectionTitle: string) => void;
}

const DAY_PRESETS = [
  { label: '1d', value: 1 },
  { label: '3d', value: 3 },
  { label: '5d', value: 5 },
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
];

const HOUR_PRESETS = [
  { label: '1h', value: 1 },
  { label: '2h', value: 2 },
  { label: '3h', value: 3 },
  { label: '4h', value: 4 },
  { label: '6h', value: 6 },
];

const FOCUS_OPTIONS: Array<{ id: OAFocusMode; label: string }> = [
  { id: 'high_frequency', label: 'Most Asked' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'weakness_focus', label: 'Weak Spots' },
  { id: 'crash_course', label: 'Crash Course' },
];

const ALL_COMPANIES_SORTED = [...COMPANIES].sort((a, b) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
);

export default function OAReadyModal({
  initialCompanyId,
  onClose,
  onOpenGeneralChat,
  onOpenProblemTutor,
}: OAReadyModalProps) {
  const navigate = useNavigate();

  const progress = usePaceStore((s) => s.progress);
  const customTracks = usePaceStore((s) => s.customTracks);
  const saveCustomTrack = usePaceStore((s) => s.saveCustomTrack);
  const renameCustomTrack = usePaceStore((s) => s.renameCustomTrack);
  const deleteCustomTrack = usePaceStore((s) => s.deleteCustomTrack);

  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const selectedCompanyMeta = useMemo(
    () => getCompanyMeta(selectedCompanyId) || COMPANIES[0],
    [selectedCompanyId]
  );

  const [days, setDays] = useState<number>(5);
  const [hoursPerDay, setHoursPerDay] = useState<number>(2);
  const [focusMode, setFocusMode] = useState<OAFocusMode>('high_frequency');
  const [trackName, setTrackName] = useState<string>(
    `${selectedCompanyMeta.name} OA (${days}d)`
  );
  const [userEditedName, setUserEditedName] = useState(false);

  const [view, setView] = useState<'configure' | 'builder'>('configure');
  const [isBuilding, setIsBuilding] = useState(false);
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [builtTrack, setBuiltTrack] = useState<CustomTrack | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [deleteTargetTrack, setDeleteTargetTrack] = useState<CustomTrack | null>(null);

  const buildCancelRef = useRef<number>(0);

  // Sync default track name when company or days change
  useEffect(() => {
    if (!userEditedName) {
      setTrackName(`${selectedCompanyMeta.name} OA (${days}d)`);
    }
  }, [selectedCompanyMeta.name, days, userEditedName]);

  // Lock background scroll
  useEffect(() => {
    const origBody = document.body.style.overflow;
    const origHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origBody;
      document.documentElement.style.overflow = origHtml;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleteTargetTrack) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, deleteTargetTrack]);

  const totalHours = Math.max(1, Math.round(days * hoursPerDay * 10) / 10);
  const estimatedProblems = useMemo(() => {
    const mins = totalHours * 60;
    const avg = focusMode === 'crash_course' ? 24 : 30;
    return Math.max(5, Math.min(85, Math.round(mins / avg)));
  }, [totalHours, focusMode]);

  const savedTracksList = useMemo(() => {
    return Object.values(customTracks || {}).sort((a, b) => b.createdAt - a.createdAt);
  }, [customTracks]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const handleStartBuild = async () => {
    const runId = ++buildCancelRef.current;
    setView('builder');
    setIsBuilding(true);
    setRevealedCount(0);
    setIsSaved(false);

    try {
      const cleanTitle = trackName.trim() || `${selectedCompanyMeta.name} OA (${days}d)`;

      // Instant deterministic blueprint first so sections start revealing immediately
      const initialResult = await buildOAReadyTrack(
        {
          companyId: selectedCompanyId,
          trackTitle: cleanTitle,
          days,
          hoursPerDay,
          focusMode,
          progress,
        },
        false
      );

      if (buildCancelRef.current !== runId) return;
      setBuiltTrack(initialResult.track);

      // Kick off AI reasoning refinement in parallel while sections reveal one by one
      const aiPromise = buildOAReadyTrack(
        {
          companyId: selectedCompanyId,
          trackTitle: cleanTitle,
          days,
          hoursPerDay,
          focusMode,
          progress,
        },
        true
      ).catch(() => initialResult);

      const totalGroups = initialResult.track.groups.length;
      for (let i = 1; i <= totalGroups; i++) {
        await sleep(320);
        if (buildCancelRef.current !== runId) return;
        setRevealedCount(i);
      }

      const aiRes = await aiPromise;
      if (buildCancelRef.current !== runId) return;

      setBuiltTrack((prev) =>
        prev
          ? {
              ...prev,
              overallReasoning: aiRes.track.overallReasoning,
              sectionMeta: aiRes.track.sectionMeta,
            }
          : aiRes.track
      );
      setIsBuilding(false);
    } catch (err) {
      console.error('OA Ready build error:', err);
      setIsBuilding(false);
    }
  };

  const handleSaveTrack = () => {
    if (!builtTrack) return;
    const cleanTitle = trackName.trim() || builtTrack.title;
    const shortLabel =
      cleanTitle.length > 16 ? `${selectedCompanyMeta.name.slice(0, 10)} OA` : cleanTitle;
    const toSave: CustomTrack = {
      ...builtTrack,
      title: cleanTitle,
      shortLabel,
    };
    saveCustomTrack(toSave);
    setBuiltTrack(toSave);
    setIsSaved(true);
  };

  const handleTrackNameEdit = (val: string) => {
    setTrackName(val);
    setUserEditedName(true);
    if (isSaved && builtTrack) {
      renameCustomTrack(builtTrack.id, val);
    }
  };

  const totalBuiltProblems = useMemo(() => {
    if (!builtTrack) return 0;
    return builtTrack.groups.reduce((acc, g) => acc + g.problems.length, 0);
  }, [builtTrack]);

  const progressPercent = useMemo(() => {
    if (!builtTrack) return 15;
    if (!isBuilding) return 100;
    const total = Math.max(1, builtTrack.groups.length);
    return Math.min(95, Math.round(15 + (revealedCount / total) * 80));
  }, [builtTrack, isBuilding, revealedCount]);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${styles.modal} ${view === 'builder' ? styles.modalWide : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimal Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {view === 'builder' ? (
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => {
                  buildCancelRef.current++;
                  setIsBuilding(false);
                  setView('configure');
                }}
                title="Back to settings"
              >
                <ArrowLeft size={16} />
              </button>
            ) : (
              <Sparkles size={16} className={styles.headerIcon} />
            )}
            <h2 className={styles.title}>
              {view === 'builder' && builtTrack
                ? builtTrack.title
                : `OA Ready — ${selectedCompanyMeta.name}`}
            </h2>
          </div>

          <div className={styles.headerRight}>
            {onOpenGeneralChat && (
              <button
                type="button"
                className={styles.textBtn}
                onClick={() => {
                  onClose();
                  onOpenGeneralChat();
                }}
              >
                <MessageSquare size={12} />
                <span>Chat</span>
              </button>
            )}
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close OA Ready"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {view === 'configure' && (
            <>
              <div className={styles.form}>
                {/* Company */}
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <span>Company</span>
                    <span className={styles.labelHint}>{selectedCompanyMeta.total} questions</span>
                  </div>
                  <select
                    className={styles.select}
                    value={selectedCompanyId}
                    onChange={(e) => {
                      setSelectedCompanyId(e.target.value);
                      setUserEditedName(false);
                    }}
                  >
                    {ALL_COMPANIES_SORTED.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Days left */}
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <span>Days until OA</span>
                    <span className={styles.labelHint}>{days} {days === 1 ? 'day' : 'days'}</span>
                  </div>
                  <div className={styles.pills}>
                    {DAY_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        className={`${styles.pill} ${days === p.value ? styles.pillActive : ''}`}
                        onClick={() => setDays(p.value)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Daily hours */}
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <span>Hours per day</span>
                    <span className={styles.labelHint}>{hoursPerDay}h / day</span>
                  </div>
                  <div className={styles.pills}>
                    {HOUR_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        className={`${styles.pill} ${hoursPerDay === p.value ? styles.pillActive : ''}`}
                        onClick={() => setHoursPerDay(p.value)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Focus */}
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <span>Focus</span>
                  </div>
                  <div className={styles.pills}>
                    {FOCUS_OPTIONS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`${styles.pill} ${focusMode === f.id ? styles.pillActive : ''}`}
                        onClick={() => setFocusMode(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Track Name */}
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <span>Track name</span>
                    <span className={styles.labelHint}>For saving to your tracks</span>
                  </div>
                  <input
                    type="text"
                    className={styles.input}
                    value={trackName}
                    onChange={(e) => handleTrackNameEdit(e.target.value)}
                    placeholder={`${selectedCompanyMeta.name} OA`}
                  />
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                  <span className={styles.budgetSummary}>
                    <strong>{totalHours}h total</strong> · ~{estimatedProblems} problems
                  </span>
                  <button type="button" className={styles.primaryBtn} onClick={handleStartBuild}>
                    <span>Build Track</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Compact Saved OA Tracks list if any exist */}
              {savedTracksList.length > 0 && (
                <div className={styles.savedSection}>
                  <span className={styles.savedTitle}>Saved OA Tracks</span>
                  {savedTracksList.map((ct) => {
                    const probs = ct.groups.flatMap((g) => g.problems);
                    const solved = probs.reduce((acc, p) => acc + (progress[p.id] ? 1 : 0), 0);
                    return (
                      <div key={ct.id} className={styles.savedRow}>
                        <div className={styles.savedRowLeft}>
                          <div className={styles.savedRowName}>{ct.title}</div>
                          <div className={styles.savedRowMeta}>
                            {ct.companyName} · {solved}/{probs.length} solved
                          </div>
                        </div>
                        <div className={styles.savedRowActions}>
                          <button
                            type="button"
                            className={styles.textBtn}
                            onClick={() => {
                              onClose();
                              navigate(`/track/${ct.id}`);
                            }}
                          >
                            <span>Open</span>
                            <ArrowRight size={12} />
                          </button>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => setDeleteTargetTrack(ct)}
                            title="Delete track"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {view === 'builder' && builtTrack && (
            <div className={styles.resultContainer}>
              {/* Live build progress bar (only visible while building) */}
              {isBuilding && (
                <div className={styles.buildStatusRow}>
                  <div className={styles.buildStatusText}>
                    <span>
                      <span className={styles.pulseDot} />
                      Building section {Math.min(revealedCount + 1, builtTrack.groups.length)} of{' '}
                      {builtTrack.groups.length}...
                    </span>
                    <span className="mono">{progressPercent}%</span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Concise Pacer Reasoning */}
              <div className={styles.reasoningBox}>
                <div className={styles.reasoningHeader}>
                  <span>Why this path ({totalBuiltProblems} problems · {totalHours}h)</span>
                </div>
                <p className={styles.reasoningText}>{builtTrack.overallReasoning}</p>
              </div>

              {/* Clean Save Bar */}
              <div className={styles.saveBar}>
                <input
                  type="text"
                  className={styles.saveNameInput}
                  value={trackName}
                  onChange={(e) => handleTrackNameEdit(e.target.value)}
                  placeholder="Track name..."
                />
                <div className={styles.saveActions}>
                  {!isSaved ? (
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={handleSaveTrack}
                      style={{ height: 32, fontSize: '0.8rem', padding: '0 13px' }}
                    >
                      <span>Save as Track</span>
                    </button>
                  ) : (
                    <>
                      <span className={styles.savedBadge}>
                        <Check size={13} />
                        <span>Saved</span>
                      </span>
                      <button
                        type="button"
                        className={styles.textBtn}
                        style={{ height: 32 }}
                        onClick={() => {
                          onClose();
                          navigate(`/track/${builtTrack.id}`);
                        }}
                      >
                        <span>Open in Tracks</span>
                        <ArrowRight size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Dynamic Sections */}
              <div className={styles.sectionsList}>
                {builtTrack.groups.slice(0, revealedCount).map((group, idx) => {
                  const secMeta = builtTrack.sectionMeta?.[group.id];
                  return (
                    <div key={group.id} className={styles.sectionItem}>
                      <TopicSection
                        group={group}
                        index={idx}
                        accent="var(--accent)"
                        note={secMeta ? secMeta.reasoning : null}
                        defaultOpen={idx === 0}
                        onOpenTutor={(session) => {
                          if (onOpenProblemTutor && session.currentProblem) {
                            onOpenProblemTutor(session.currentProblem, group.title);
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteTargetTrack && (
        <ConfirmDialog
          title={`Delete "${deleteTargetTrack.title}"?`}
          body={`This removes "${deleteTargetTrack.title}" from your saved tracks.`}
          confirmLabel="Delete"
          onConfirm={() => {
            deleteCustomTrack(deleteTargetTrack.id);
            if (builtTrack?.id === deleteTargetTrack.id) {
              setIsSaved(false);
            }
            setDeleteTargetTrack(null);
          }}
          onCancel={() => setDeleteTargetTrack(null)}
        />
      )}
    </div>,
    document.body
  );
}
