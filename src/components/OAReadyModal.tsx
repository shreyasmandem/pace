import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookmarkCheck,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  FolderKanban,
  Layers,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { COMPANIES, getCompanyMeta } from '../data';
import { buildOAReadyTrack, type OAScrapeTelemetry } from '../lib/oaReady';
import { usePaceStore } from '../state/store';
import type { CustomTrack, OAFocusMode, Problem } from '../types';
import TopicSection from './TopicSection';
import ConfirmDialog from './ConfirmDialog';
import styles from './OAReadyModal.module.css';

export interface OAReadyModalProps {
  initialCompanyId: string;
  onClose: () => void;
  onOpenGeneralChat?: () => void;
  onOpenProblemTutor?: (problem: Problem, sectionTitle: string) => void;
}

const DAY_PRESETS = [
  { value: 1, label: '1d Blitz' },
  { value: 3, label: '3 Days' },
  { value: 5, label: '5 Days' },
  { value: 7, label: '7 Days' },
  { value: 14, label: '14 Days' },
  { value: 30, label: '30 Days' },
];

const HOUR_PRESETS = [
  { value: 1, label: '1h / day' },
  { value: 2, label: '2h / day' },
  { value: 3, label: '3h / day' },
  { value: 4, label: '4h / day' },
  { value: 6, label: '6h / day' },
];

const FOCUS_STRATEGIES: Array<{
  id: OAFocusMode;
  title: string;
  badge: string;
  desc: string;
}> = [
  {
    id: 'high_frequency',
    title: 'High-Frequency OA Sprint',
    badge: 'Recommended',
    desc: 'Prioritizes verified 30-day & 3-month company assessment hits + Blind 75 pattern anchors.',
  },
  {
    id: 'balanced',
    title: 'Balanced Pattern Mastery',
    badge: 'Structured',
    desc: 'Stepped progression from Easy speed warm-ups to Medium core invariants and Hard stretch problems.',
  },
  {
    id: 'crash_course',
    title: 'Last-Minute Crash Course',
    badge: '<48h Prep',
    desc: 'Ultra-high ROI must-solve patterns designed to maximize test-case pass rate in minimal hours.',
  },
  {
    id: 'weakness_focus',
    title: 'Hard & Differentiator Focus',
    badge: 'Deep Dive',
    desc: 'Targets OA filter topics: Dynamic Programming, Graph BFS/DFS, Monotonic Stack, and Greedy.',
  },
];

export default function OAReadyModal({
  initialCompanyId,
  onClose,
  onOpenGeneralChat,
  onOpenProblemTutor,
}: OAReadyModalProps) {
  const navigate = useNavigate();
  const progress = usePaceStore((s) => s.progress);
  const customTracks = usePaceStore((s) => s.customTracks || {});
  const saveCustomTrack = usePaceStore((s) => s.saveCustomTrack);
  const renameCustomTrack = usePaceStore((s) => s.renameCustomTrack);
  const deleteCustomTrack = usePaceStore((s) => s.deleteCustomTrack);

  const savedTracksList = useMemo(
    () => Object.values(customTracks).sort((a, b) => b.createdAt - a.createdAt),
    [customTracks]
  );

  const [activeTab, setActiveTab] = useState<'config' | 'builder' | 'saved'>('config');

  // Form states
  const [companyId, setCompanyId] = useState(initialCompanyId || 'google');
  const [companyFilter, setCompanyFilter] = useState('');
  const [days, setDays] = useState<number>(5);
  const [hoursPerDay, setHoursPerDay] = useState<number>(2);
  const [focusMode, setFocusMode] = useState<OAFocusMode>('high_frequency');
  const [trackName, setTrackName] = useState<string>('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');

  // Dynamic Builder states
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildStep, setBuildStep] = useState(0); // 0..4
  const [revealedSectionsCount, setRevealedSectionsCount] = useState(0);
  const [builtTrack, setBuiltTrack] = useState<CustomTrack | null>(null);
  const [telemetry, setTelemetry] = useState<OAScrapeTelemetry | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [deleteTargetTrack, setDeleteTargetTrack] = useState<CustomTrack | null>(null);

  const buildTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const selectedCompanyMeta = useMemo(
    () =>
      getCompanyMeta(companyId) || {
        id: companyId,
        name: companyId.charAt(0).toUpperCase() + companyId.slice(1),
        total: 0,
        easy: 0,
        medium: 0,
        hard: 0,
      },
    [companyId]
  );

  // Keep default track name synced unless user typed a custom name
  useEffect(() => {
    if (!nameManuallyEdited) {
      setTrackName(`${selectedCompanyMeta.name} OA Ready (${days}d)`);
    }
  }, [selectedCompanyMeta.name, days, nameManuallyEdited]);

  // Body & HTML scroll lock
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const origBody = document.body.style.overflow;
    const origHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origBody;
      document.documentElement.style.overflow = origHtml;
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      buildTimersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Escape key closes modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleteTargetTrack) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, deleteTargetTrack]);

  const filteredCompanies = useMemo(() => {
    const q = companyFilter.trim().toLowerCase();
    const sorted = [...COMPANIES].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [companyFilter]);

  const totalHoursBudget = useMemo(
    () => Math.round(Math.max(1, days) * Math.max(0.5, hoursPerDay) * 10) / 10,
    [days, hoursPerDay]
  );

  const estimatedProblemCount = useMemo(() => {
    const mins = totalHoursBudget * 60;
    const minCount = focusMode === 'crash_course' ? 6 : 8;
    return Math.min(120, Math.max(minCount, Math.round(mins / 30)));
  }, [totalHoursBudget, focusMode]);

  const clearBuildTimers = () => {
    buildTimersRef.current.forEach((t) => clearTimeout(t));
    buildTimersRef.current = [];
  };

  const handleStartBuild = async () => {
    clearBuildTimers();
    setActiveTab('builder');
    setIsBuilding(true);
    setIsSaved(false);
    setBuildStep(1);
    setRevealedSectionsCount(0);

    // Step 1: Immediate fast deterministic build so sections can start rendering dynamically
    const initialResult = await buildOAReadyTrack(
      {
        companyId,
        trackTitle: trackName.trim() || `${selectedCompanyMeta.name} OA Ready (${days}d)`,
        days,
        hoursPerDay,
        focusMode,
        customPrompt,
        progress,
      },
      false
    );

    setBuiltTrack(initialResult.track);
    setTelemetry(initialResult.telemetry);

    const totalGroups = initialResult.track.groups.length;

    // Schedule pipeline telemetry stages & dynamic section-by-section construction
    const t1 = setTimeout(() => setBuildStep(2), 420);
    const t2 = setTimeout(() => setBuildStep(3), 860);
    const t3 = setTimeout(() => setBuildStep(4), 1300);
    buildTimersRef.current.push(t1, t2, t3);

    for (let i = 1; i <= totalGroups; i++) {
      const timer = setTimeout(() => {
        setRevealedSectionsCount(i);
      }, 650 + i * 420);
      buildTimersRef.current.push(timer);
    }

    const finishTimer = setTimeout(() => {
      setIsBuilding(false);
      setBuildStep(5);
      setRevealedSectionsCount(totalGroups);
    }, 850 + totalGroups * 420);
    buildTimersRef.current.push(finishTimer);

    // Concurrently run Pacer AI Groq refinement in background to upgrade reasoning notes smoothly
    buildOAReadyTrack(
      {
        companyId,
        trackTitle: trackName.trim() || `${selectedCompanyMeta.name} OA Ready (${days}d)`,
        days,
        hoursPerDay,
        focusMode,
        customPrompt,
        progress,
      },
      true
    )
      .then((aiResult) => {
        setBuiltTrack((prev) => {
          if (!prev) return aiResult.track;
          return {
            ...prev,
            overallReasoning: aiResult.track.overallReasoning,
            sectionMeta: aiResult.track.sectionMeta,
          };
        });
      })
      .catch(() => {
        // Keep deterministic reasoning if offline
      });
  };

  const handleSaveTrackToAccount = () => {
    if (!builtTrack) return;
    const finalTitle = trackName.trim() || builtTrack.title;
    const shortLabel =
      finalTitle.length > 18
        ? `${builtTrack.companyName.slice(0, 12)} OA`
        : finalTitle;

    const toSave: CustomTrack = {
      ...builtTrack,
      title: finalTitle,
      shortLabel,
    };

    saveCustomTrack(toSave);
    setBuiltTrack(toSave);
    setIsSaved(true);
  };

  const handleTrackNameChangeInBlueprint = (val: string) => {
    setTrackName(val);
    setNameManuallyEdited(true);
    if (builtTrack) {
      const updated = {
        ...builtTrack,
        title: val,
        shortLabel: val.length > 18 ? `${builtTrack.companyName.slice(0, 12)} OA` : val,
      };
      setBuiltTrack(updated);
      if (isSaved && val.trim()) {
        renameCustomTrack(builtTrack.id, val.trim());
      }
    }
  };

  const handleOpenSavedTrackInModal = (track: CustomTrack) => {
    clearBuildTimers();
    setBuiltTrack(track);
    setTrackName(track.title);
    setNameManuallyEdited(true);
    setIsBuilding(false);
    setBuildStep(5);
    setRevealedSectionsCount(track.groups.length);
    setIsSaved(true);
    const totalProbs = track.groups.reduce((acc, g) => acc + g.problems.length, 0);
    setTelemetry({
      companyProblemsScanned: getCompanyMeta(track.companyId)?.total || totalProbs,
      canonicalProblemsScanned: 855,
      crossTrackMatches: Math.round(totalProbs * 0.65),
      dominantTopics: track.keyPatterns,
      totalMinutesBudget: Math.round(track.totalHoursBudget * 60),
      selectedProblemsCount: totalProbs,
    });
    setActiveTab('builder');
  };

  const buildProgressPercent = useMemo(() => {
    if (!isBuilding && buildStep >= 5) return 100;
    if (!builtTrack || builtTrack.groups.length === 0) return Math.min(90, buildStep * 22);
    const sectionRatio = revealedSectionsCount / builtTrack.groups.length;
    return Math.min(96, Math.round(20 + sectionRatio * 76));
  }, [isBuilding, buildStep, builtTrack, revealedSectionsCount]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.pacerLogoBadge}>
              <Sparkles size={19} />
            </div>
            <div className={styles.headerTitleGroup}>
              <div className={styles.headerTitleRow}>
                <h2 className={styles.headerTitle}>OA Ready</h2>
                <span className={styles.aiBadge}>
                  <Sparkles size={10} />
                  Pacer AI Architect
                </span>
              </div>
              <p className={styles.headerSubtitle}>
                Scrapes 500+ company OA vaults &amp; canonical tracks to engineer your personalized assessment roadmap.
              </p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.navTabs}>
              <button
                type="button"
                className={`${styles.navTabBtn} ${activeTab === 'config' ? styles.navTabActive : ''}`}
                onClick={() => setActiveTab('config')}
              >
                <Compass size={13} />
                <span>Configure</span>
              </button>
              {builtTrack && (
                <button
                  type="button"
                  className={`${styles.navTabBtn} ${activeTab === 'builder' ? styles.navTabActive : ''}`}
                  onClick={() => setActiveTab('builder')}
                >
                  <Layers size={13} />
                  <span>OA Track ({builtTrack.groups.reduce((a, g) => a + g.problems.length, 0)})</span>
                </button>
              )}
              {savedTracksList.length > 0 && (
                <button
                  type="button"
                  className={`${styles.navTabBtn} ${activeTab === 'saved' ? styles.navTabActive : ''}`}
                  onClick={() => setActiveTab('saved')}
                >
                  <FolderKanban size={13} />
                  <span>Saved ({savedTracksList.length})</span>
                </button>
              )}
            </div>

            {onOpenGeneralChat && (
              <button
                type="button"
                className={styles.askPacerQuickBtn}
                onClick={() => {
                  onClose();
                  onOpenGeneralChat();
                }}
                title={`Open Pacer AI Chat for ${selectedCompanyMeta.name}`}
              >
                <Bot size={14} />
                <span>Ask Pacer Chat</span>
              </button>
            )}

            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {activeTab === 'config' && (
            <div className={styles.configContainer}>
              {/* Intro Banner */}
              <div className={styles.introBanner}>
                <div className={styles.introText}>
                  <h4>Tell Pacer AI about your upcoming Online Assessment</h4>
                  <p>
                    Pacer scans every verified question for <strong>{selectedCompanyMeta.name}</strong>,
                    cross-references Striver&apos;s A2Z, NeetCode 150/250, and Blind 75, filters out
                    problems you&apos;ve already solved, and builds a reasoned, time-boxed track you can
                    save directly to your account.
                  </p>
                </div>
                <div className={styles.budgetPreviewBadge}>
                  <span className={styles.budgetHours}>{totalHoursBudget} hrs total</span>
                  <span className={styles.budgetSub}>
                    ~{estimatedProblemCount} high-ROI problems
                  </span>
                </div>
              </div>

              <div className={styles.formGrid}>
                {/* 1. Target Company */}
                <div className={styles.fieldCard}>
                  <div className={styles.fieldLabelRow}>
                    <span className={styles.fieldLabel}>
                      <Building2 size={15} color="var(--accent)" />
                      Target Company
                    </span>
                    <span className={styles.fieldHint}>500+ companies indexed</span>
                  </div>

                  <div className={styles.companySelectRow}>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="Filter company list (e.g. Accenture, Amazon, Stripe)..."
                      value={companyFilter}
                      onChange={(e) => setCompanyFilter(e.target.value)}
                    />
                    <select
                      className={styles.selectInput}
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                    >
                      {filteredCompanies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.total} verified problems)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.companyMetaStrip}>
                    <span className={styles.metaPill}>Total: {selectedCompanyMeta.total}</span>
                    <span className={styles.metaPill} style={{ color: 'var(--difficulty-easy)' }}>
                      Easy: {selectedCompanyMeta.easy}
                    </span>
                    <span className={styles.metaPill} style={{ color: 'var(--difficulty-medium)' }}>
                      Med: {selectedCompanyMeta.medium}
                    </span>
                    <span className={styles.metaPill} style={{ color: 'var(--difficulty-hard)' }}>
                      Hard: {selectedCompanyMeta.hard}
                    </span>
                  </div>
                </div>

                {/* 2. Track Name & Custom Focus */}
                <div className={styles.fieldCard}>
                  <div className={styles.fieldLabelRow}>
                    <span className={styles.fieldLabel}>
                      <BookmarkCheck size={15} color="var(--accent)" />
                      Personalized Track Name
                    </span>
                    <span className={styles.fieldHint}>Editable anytime</span>
                  </div>

                  <input
                    type="text"
                    className={styles.textInput}
                    value={trackName}
                    onChange={(e) => {
                      setTrackName(e.target.value);
                      setNameManuallyEdited(true);
                    }}
                    placeholder={`e.g. ${selectedCompanyMeta.name} OA Ready`}
                    maxLength={48}
                  />

                  <div className={styles.fieldLabelRow} style={{ marginTop: '4px' }}>
                    <span className={styles.fieldLabel}>
                      <Target size={14} color="var(--accent)" />
                      Specific Topics or Role Notes (Optional)
                    </span>
                  </div>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g. SDE Intern HackerRank, focus on Graphs, Sliding Window, DP..."
                  />
                </div>

                {/* 3. Days Available */}
                <div className={styles.fieldCard}>
                  <div className={styles.fieldLabelRow}>
                    <span className={styles.fieldLabel}>
                      <Calendar size={15} color="var(--accent)" />
                      Days Until Your OA
                    </span>
                    <span className={styles.fieldHint}>{days} {days === 1 ? 'day' : 'days'}</span>
                  </div>

                  <div className={styles.pillRow}>
                    {DAY_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        className={`${styles.optionPill} ${days === p.value ? styles.optionPillActive : ''}`}
                        onClick={() => {
                          setDays(p.value);
                          if (p.value === 1) setFocusMode('crash_course');
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className={styles.customNumberRow}>
                    <span className={styles.fieldHint}>Custom days:</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      className={styles.customNumberInput}
                      value={days}
                      onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                    />
                  </div>
                </div>

                {/* 4. Hours Per Day */}
                <div className={styles.fieldCard}>
                  <div className={styles.fieldLabelRow}>
                    <span className={styles.fieldLabel}>
                      <Clock size={15} color="var(--accent)" />
                      Daily Preparation Time
                    </span>
                    <span className={styles.fieldHint}>{hoursPerDay} hrs / day</span>
                  </div>

                  <div className={styles.pillRow}>
                    {HOUR_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        className={`${styles.optionPill} ${hoursPerDay === p.value ? styles.optionPillActive : ''}`}
                        onClick={() => setHoursPerDay(p.value)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className={styles.customNumberRow}>
                    <span className={styles.fieldHint}>Custom hours/day:</span>
                    <input
                      type="number"
                      min={0.5}
                      max={12}
                      step={0.5}
                      className={styles.customNumberInput}
                      value={hoursPerDay}
                      onChange={(e) =>
                        setHoursPerDay(Math.max(0.5, Math.min(12, Number(e.target.value) || 1)))
                      }
                    />
                  </div>
                </div>

                {/* 5. Strategy Selection */}
                <div className={`${styles.fieldCard} ${styles.fieldCardFull}`}>
                  <div className={styles.fieldLabelRow}>
                    <span className={styles.fieldLabel}>
                      <Zap size={15} color="var(--accent)" />
                      Pacer AI Curation Strategy
                    </span>
                    <span className={styles.fieldHint}>
                      Automatically skips problems you have already solved
                    </span>
                  </div>

                  <div className={styles.strategyGrid}>
                    {FOCUS_STRATEGIES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`${styles.strategyCard} ${
                          focusMode === s.id ? styles.strategyCardActive : ''
                        }`}
                        onClick={() => setFocusMode(s.id)}
                      >
                        <div className={styles.strategyTitle}>
                          <span>{s.title}</span>
                          <span className={styles.aiBadge}>{s.badge}</span>
                        </div>
                        <span className={styles.strategyDesc}>{s.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.generateFooter}>
                <span className={styles.generateFooterNote}>
                  Pacer AI will scrape {selectedCompanyMeta.name}&apos;s question bank + all 4 core tracks
                  to build a {totalHoursBudget}-hour custom track (~{estimatedProblemCount} problems).
                </span>
                <button type="button" className={styles.generateBtn} onClick={handleStartBuild}>
                  <Sparkles size={16} />
                  <span>Build My OA Ready Track</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'builder' && builtTrack && (
            <div className={styles.builderPage}>
              {/* Live Dynamic Building Telemetry Header */}
              <div className={styles.telemetryPanel}>
                <div className={styles.telemetryHeader}>
                  <div className={styles.telemetryStatusTitle}>
                    {isBuilding ? (
                      <>
                        <span className={styles.pulseDot} />
                        <span>
                          Pacer AI is dynamically building <strong>{builtTrack.title}</strong>...
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} color="var(--difficulty-easy)" />
                        <span>
                          OA Ready Blueprint Complete — <strong>{builtTrack.title}</strong>
                        </span>
                      </>
                    )}
                  </div>
                  <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>
                    {buildProgressPercent}%
                  </span>
                </div>

                <div className={styles.progressBarTrack}>
                  <div
                    className={styles.progressBarFill}
                    style={{ width: `${buildProgressPercent}%` }}
                  />
                </div>

                <div className={styles.stepsList}>
                  <div
                    className={`${styles.stepItem} ${
                      buildStep === 1 ? styles.stepItemActive : buildStep > 1 ? styles.stepItemDone : ''
                    }`}
                  >
                    <span>{buildStep > 1 ? '✓' : '▸'}</span>
                    <span>
                      Scraped {telemetry?.companyProblemsScanned || 0} {builtTrack.companyName} OA problems
                    </span>
                  </div>
                  <div
                    className={`${styles.stepItem} ${
                      buildStep === 2 ? styles.stepItemActive : buildStep > 2 ? styles.stepItemDone : ''
                    }`}
                  >
                    <span>{buildStep > 2 ? '✓' : '▸'}</span>
                    <span>
                      Cross-referenced {telemetry?.canonicalProblemsScanned || 855} A2Z, NC150/250 &amp; Blind 75 items
                    </span>
                  </div>
                  <div
                    className={`${styles.stepItem} ${
                      buildStep === 3 ? styles.stepItemActive : buildStep > 3 ? styles.stepItemDone : ''
                    }`}
                  >
                    <span>{buildStep > 3 ? '✓' : '▸'}</span>
                    <span>
                      Calibrated for {builtTrack.days}d × {builtTrack.hoursPerDay}h/day ({builtTrack.totalHoursBudget}h budget)
                    </span>
                  </div>
                  <div
                    className={`${styles.stepItem} ${
                      buildStep === 4 ? styles.stepItemActive : buildStep > 4 ? styles.stepItemDone : ''
                    }`}
                  >
                    <span>{buildStep > 4 ? '✓' : '▸'}</span>
                    <span>
                      Assembled {revealedSectionsCount} of {builtTrack.groups.length} prioritized OA phases
                    </span>
                  </div>
                </div>
              </div>

              {/* Executive Strategy & Save Bar */}
              <div className={styles.strategyHeroCard}>
                <div className={styles.strategyHeroTop}>
                  <div>
                    <div className={styles.strategyBadgeRow}>
                      <span className={styles.pacerReasoningTag}>
                        <Sparkles size={11} />
                        Why Pacer Chose This Path
                      </span>
                      {builtTrack.keyPatterns.map((pat) => (
                        <span key={pat} className={styles.metaPill}>
                          {pat}
                        </span>
                      ))}
                    </div>
                    <p className={styles.strategyReasoningText}>{builtTrack.overallReasoning}</p>
                  </div>
                </div>

                <div className={styles.telemetryMetricsRow}>
                  <span className={styles.metricBadge}>
                    Curated Problems:{' '}
                    <strong>
                      {builtTrack.groups.reduce((acc, g) => acc + g.problems.length, 0)}
                    </strong>
                  </span>
                  <span className={styles.metricBadge}>
                    Prep Window: <strong>{builtTrack.days}d ({builtTrack.hoursPerDay}h/day)</strong>
                  </span>
                  <span className={styles.metricBadge}>
                    Total Time Budget: <strong>{builtTrack.totalHoursBudget} hrs</strong>
                  </span>
                  {telemetry && (
                    <span className={styles.metricBadge}>
                      Cross-Track Matches: <strong>{telemetry.crossTrackMatches}</strong>
                    </span>
                  )}
                </div>

                {/* Save as Personalized Track Controls */}
                <div className={styles.saveTrackBar}>
                  <div className={styles.saveTrackNameGroup}>
                    <label className={styles.saveTrackLabel} htmlFor="oaCustomTrackName">
                      Track Name:
                    </label>
                    <input
                      id="oaCustomTrackName"
                      type="text"
                      className={styles.saveTrackInput}
                      value={trackName}
                      onChange={(e) => handleTrackNameChangeInBlueprint(e.target.value)}
                      placeholder="Name your personalized OA track..."
                      maxLength={48}
                    />
                  </div>

                  <div className={styles.saveTrackActions}>
                    <button
                      type="button"
                      className={styles.rebuildBtn}
                      onClick={() => setActiveTab('config')}
                    >
                      <RotateCcw size={13} />
                      <span>Adjust Preferences</span>
                    </button>

                    {!isSaved ? (
                      <button
                        type="button"
                        className={styles.saveTrackPrimaryBtn}
                        onClick={handleSaveTrackToAccount}
                      >
                        <Sparkles size={14} />
                        <span>Save as Personalized Track</span>
                      </button>
                    ) : (
                      <>
                        <span className={styles.savedSuccessBtn}>
                          <Check size={14} />
                          <span>Saved to Enrolled Tracks</span>
                        </span>
                        <button
                          type="button"
                          className={styles.openSavedTrackBtn}
                          onClick={() => {
                            onClose();
                            navigate(`/track/${builtTrack.id}`);
                          }}
                        >
                          <span>Open in Track View</span>
                          <ArrowRight size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic Section-by-Section Rendering */}
              <div className={styles.sectionsContainer}>
                {builtTrack.groups.slice(0, revealedSectionsCount).map((group, idx) => {
                  const secMeta = builtTrack.sectionMeta?.[group.id];
                  return (
                    <div key={group.id} className={styles.sectionBuildCard}>
                      {secMeta && (
                        <div className={styles.sectionReasonBanner}>
                          <div className={styles.sectionReasonLeft}>
                            <Sparkles size={14} className={styles.sectionReasonIcon} />
                            <span>
                              <strong>Pacer Section Rationale:</strong> {secMeta.reasoning}
                            </span>
                          </div>
                          <span className={styles.sectionTimeTag}>
                            ~{secMeta.estimatedMinutes} mins
                          </span>
                        </div>
                      )}
                      <TopicSection
                        group={group}
                        index={idx}
                        accent="var(--accent)"
                        note={null}
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

                {isBuilding && revealedSectionsCount < builtTrack.groups.length && (
                  <div className={styles.buildingPlaceholderCard}>
                    <span className={styles.pulseDot} />
                    <span>
                      Building{' '}
                      <strong>
                        {builtTrack.groups[revealedSectionsCount]?.title || 'next OA section'}
                      </strong>{' '}
                      — selecting highest-frequency problems for your time window...
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'saved' && (
            <div className={styles.savedTracksList}>
              {savedTracksList.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  You haven&apos;t saved any personalized OA Ready tracks yet. Configure one in the
                  Configure tab!
                </p>
              ) : (
                savedTracksList.map((ct) => {
                  const probs = ct.groups.flatMap((g) => g.problems);
                  const solved = probs.reduce((acc, p) => acc + (progress[p.id] ? 1 : 0), 0);
                  return (
                    <div key={ct.id} className={styles.savedTrackItem}>
                      <div className={styles.savedTrackInfo}>
                        <div className={styles.savedTrackTitle}>{ct.title}</div>
                        <div className={styles.savedTrackMeta}>
                          {ct.companyName} • {ct.days}d ({ct.hoursPerDay}h/day) •{' '}
                          <strong className="mono">
                            {solved}/{probs.length}
                          </strong>{' '}
                          solved
                        </div>
                        <div className={styles.savedTrackReasoning}>{ct.overallReasoning}</div>
                      </div>
                      <div className={styles.savedTrackRight}>
                        <button
                          type="button"
                          className={styles.rebuildBtn}
                          onClick={() => handleOpenSavedTrackInModal(ct)}
                        >
                          <span>Inspect / Solve Here</span>
                        </button>
                        <button
                          type="button"
                          className={styles.openSavedTrackBtn}
                          onClick={() => {
                            onClose();
                            navigate(`/track/${ct.id}`);
                          }}
                        >
                          <span>Open Track</span>
                          <ArrowRight size={14} />
                        </button>
                        <button
                          type="button"
                          className={styles.deleteTrackBtn}
                          onClick={() => setDeleteTargetTrack(ct)}
                          title="Delete custom OA track"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {deleteTargetTrack && (
        <ConfirmDialog
          title={`Delete "${deleteTargetTrack.title}"?`}
          body={`This removes your personalized "${deleteTargetTrack.title}" OA track from your enrolled tracks. Are you sure?`}
          confirmLabel="Delete OA Track"
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
