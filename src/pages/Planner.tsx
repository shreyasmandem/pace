import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  ExternalLink,
  Bot,
  Trash2,
  Check,
  Copy,
  Download,
  Flame,
  ArrowRight,
  X,
  Search,
  Layers,
  Zap,
  GraduationCap,
  Scale,
  Target,
} from 'lucide-react';
import { usePaceStore, currentStreak, type PlanItem } from '../state/store';
import { ALL_TRACKS, TRACK_META, TRACK_ORDER, getA2ZSteps, getTrack } from '../data';
import type { TrackId, ProblemLinks } from '../types';
import { generateSmartPlan, type SmartPlanStrategy } from '../lib/smartPlanner';
import {
  createGoogleCalendarUrl,
  generateIcsCalendar,
  generateWeekIcsCalendar,
  downloadIcsFile,
  generateMarkdownPlan,
} from '../lib/calendar';
import AITutorDrawer from '../components/AITutorDrawer';
import styles from './Planner.module.css';

function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDayHeader(dateStr: string): { title: string; subtitle: string } {
  const date = parseDateKey(dateStr);
  const todayStr = toDateKey(new Date());

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toDateKey(tomorrow);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toDateKey(yesterday);

  let prefix = '';
  if (dateStr === todayStr) prefix = 'Today · ';
  else if (dateStr === tomorrowStr) prefix = 'Tomorrow · ';
  else if (dateStr === yesterdayStr) prefix = 'Yesterday · ';

  const dayName = date.toLocaleDateString(undefined, { weekday: 'long' });
  const formatted = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    title: `${prefix}${dayName}`,
    subtitle: formatted,
  };
}

export default function Planner() {
  const todayStr = useMemo(() => toDateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);

  // Store data & actions
  const registeredTracks = usePaceStore((s) => s.registeredTracks || []);
  const planner = usePaceStore((s) => s.planner || {});
  const progress = usePaceStore((s) => s.progress || {});
  const solveLog = usePaceStore((s) => s.solveLog || {});
  const streak = currentStreak(solveLog);

  // Add problem & subtopic modal state
  const [modalTrack, setModalTrack] = useState<TrackId>(registeredTracks[0] || 'a2z');
  const [modalStepId, setModalStepId] = useState<string>('a2z-step-1');
  const [modalSubtopicId, setModalSubtopicId] = useState<string>('');
  const [problemSearch, setProblemSearch] = useState<string>('');

  // AI Tutor Drawer session
  const [tutorSession, setTutorSession] = useState<{
    topicKey: string;
    topicTitle: string;
    trackTitle: string;
    item: PlanItem;
  } | null>(null);

  useEffect(() => {
    if (registeredTracks.length > 0 && !registeredTracks.includes(modalTrack)) {
      setModalTrack(registeredTracks[0]);
    }
  }, [registeredTracks, modalTrack]);

  const togglePlanItem = usePaceStore((s) => s.togglePlanItem);
  const removeFromPlan = usePaceStore((s) => s.removeFromPlan);
  const movePlanItem = usePaceStore((s) => s.movePlanItem);
  const clearDayPlan = usePaceStore((s) => s.clearDayPlan);
  const addToPlan = usePaceStore((s) => s.addToPlan);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Pacer AI Smart Planner Modal state
  const [showSmartPlannerModal, setShowSmartPlannerModal] = useState(false);
  const [smartStrategy, setSmartStrategy] = useState<SmartPlanStrategy>('interview_fast_track');
  const [smartDuration, setSmartDuration] = useState<number>(14);
  const [smartProblemsPerDay, setSmartProblemsPerDay] = useState<number>(3);
  const [smartStartOffset, setSmartStartOffset] = useState<'today' | 'tomorrow'>('today');
  const [smartTrack, setSmartTrack] = useState<TrackId | 'all'>('all');
  const [smartRestDays, setSmartRestDays] = useState<boolean>(false);
  const [smartScheduleMode, setSmartScheduleMode] = useState<'replace' | 'append'>('replace');

  // Compute live smart plan preview
  const previewPlan = useMemo(() => {
    const base = new Date();
    if (smartStartOffset === 'tomorrow') {
      base.setDate(base.getDate() + 1);
    }
    const startIso = toDateKey(base);
    const trackIds =
      smartTrack === 'all'
        ? registeredTracks.length > 0
          ? registeredTracks
          : TRACK_ORDER
        : [smartTrack];

    return generateSmartPlan({
      trackIds,
      strategy: smartStrategy,
      durationDays: smartDuration,
      problemsPerDay: smartProblemsPerDay,
      startDate: startIso,
      includeRestDays: smartRestDays,
      progress,
    });
  }, [
    smartTrack,
    smartStrategy,
    smartDuration,
    smartProblemsPerDay,
    smartStartOffset,
    smartRestDays,
    progress,
    registeredTracks,
  ]);

  const handleApplySmartPlan = () => {
    if (previewPlan.totalProblems === 0) {
      showToast('No unsolved problems available for this configuration.');
      return;
    }

    if (smartScheduleMode === 'replace') {
      for (const day of previewPlan.days) {
        clearDayPlan(day.date);
      }
    }

    for (const day of previewPlan.days) {
      if (day.problems.length > 0) {
        const items = day.problems.map((prob) => ({
          date: day.date,
          title: prob.title,
          type: 'problem' as const,
          trackId: prob.trackId,
          topicTitle: prob.topicTitle,
          problemId: prob.id,
          difficulty: prob.difficulty,
          links: prob.links,
          completed: false,
        }));
        addToPlan(day.date, items);
      }
    }

    setShowSmartPlannerModal(false);
    if (previewPlan.days[0]) {
      setSelectedDate(previewPlan.days[0].date);
    }
    showToast(`✨ Pacer AI scheduled ${previewPlan.totalProblems} problems across ${previewPlan.days.length} days!`);
  };

  // Generate 7 days for current week scrubber
  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon
    const mondayOffset = (currentDayOfWeek === 0 ? -6 : 1) - currentDayOfWeek;
    const baseMonday = new Date(today);
    baseMonday.setDate(today.getDate() + mondayOffset + weekOffset * 7);

    const days: Array<{
      dateKey: string;
      dayName: string;
      dayNum: number;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(baseMonday);
      d.setDate(baseMonday.getDate() + i);
      const key = toDateKey(d);
      days.push({
        dateKey: key,
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dayNum: d.getDate(),
        isToday: key === todayStr,
      });
    }

    return days;
  }, [weekOffset, todayStr]);

  // A2Z Steps
  const a2zSteps = useMemo(() => getA2ZSteps(), []);

  // Compute available subtopics based on modalTrack and modalStepId
  const availableSubtopics = useMemo(() => {
    if (modalTrack === 'a2z') {
      if (modalStepId === 'all') {
        return a2zSteps.flatMap((step) =>
          step.subSteps.map((sub) => ({
            id: sub.id,
            title: sub.title,
            stepTitle: step.title,
            problems: sub.problems,
          }))
        );
      }
      const step = a2zSteps.find((s) => s.id === modalStepId) || a2zSteps[0];
      return (
        step?.subSteps.map((sub) => ({
          id: sub.id,
          title: sub.title,
          stepTitle: step.title,
          problems: sub.problems,
        })) || []
      );
    }

    const trackData = getTrack(modalTrack);
    return (
      trackData?.groups.map((g) => ({
        id: g.id,
        title: g.title,
        stepTitle: TRACK_META[modalTrack].shortLabel,
        problems: g.problems,
      })) || []
    );
  }, [modalTrack, modalStepId, a2zSteps]);

  // Synchronize modalSubtopicId whenever availableSubtopics change
  useEffect(() => {
    if (availableSubtopics.length > 0) {
      const exists = availableSubtopics.some((s) => s.id === modalSubtopicId);
      if (!exists) {
        setModalSubtopicId(availableSubtopics[0].id);
      }
    } else {
      setModalSubtopicId('');
    }
  }, [availableSubtopics, modalSubtopicId]);

  // Currently active subtopic
  const currentSubtopic = useMemo(() => {
    return availableSubtopics.find((s) => s.id === modalSubtopicId) || availableSubtopics[0] || null;
  }, [availableSubtopics, modalSubtopicId]);

  // Filtered problems inside the selected subtopic
  const displayedSubtopicProblems = useMemo(() => {
    if (!currentSubtopic) return [];
    if (!problemSearch.trim()) return currentSubtopic.problems;
    const q = problemSearch.toLowerCase().trim();
    return currentSubtopic.problems.filter((p) => p.title.toLowerCase().includes(q));
  }, [currentSubtopic, problemSearch]);

  // Day items & stats
  const activeDayItems = planner[selectedDate] || [];
  const solvedCount = activeDayItems.filter((it) =>
    it.problemId ? progress[it.problemId] : it.completed
  ).length;
  const dayCompletionPercent =
    activeDayItems.length > 0
      ? Math.round((solvedCount / activeDayItems.length) * 100)
      : 0;

  // Push item to tomorrow helper
  const handlePushToTomorrow = (item: PlanItem) => {
    const curr = parseDateKey(selectedDate);
    const tomorrow = new Date(curr);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDate = toDateKey(tomorrow);
    movePlanItem(selectedDate, nextDate, item.id);
    showToast(`Deferred "${item.title}" to ${nextDate}`);
  };

  // Google Calendar 1-click sync
  const handleGoogleCalendarSync = () => {
    if (activeDayItems.length === 0) {
      showToast('No problems scheduled for this day to sync.');
      return;
    }
    const url = createGoogleCalendarUrl(selectedDate, activeDayItems);
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast('Opening Google Calendar with pre-populated study plan!');
  };

  // Export .ICS file
  const handleExportIcs = () => {
    if (activeDayItems.length === 0) {
      showToast('No problems scheduled for this day to export.');
      return;
    }
    const icsContent = generateIcsCalendar(selectedDate, activeDayItems);
    downloadIcsFile(`pace-study-${selectedDate}.ics`, icsContent);
    showToast(`Downloaded pace-study-${selectedDate}.ics!`);
  };

  // Export Week .ICS file
  const handleExportWeekIcs = () => {
    const weekMap: Record<string, PlanItem[]> = {};
    let totalItems = 0;
    for (const d of weekDays) {
      if (planner[d.dateKey] && planner[d.dateKey].length > 0) {
        weekMap[d.dateKey] = planner[d.dateKey];
        totalItems += planner[d.dateKey].length;
      }
    }
    if (totalItems === 0) {
      showToast('No problems scheduled in this week to export.');
      return;
    }
    const icsContent = generateWeekIcsCalendar(weekMap);
    downloadIcsFile('pace-week-schedule.ics', icsContent);
    showToast(`Exported full week schedule (${totalItems} problems)!`);
  };

  // Copy Markdown for Notion / Obsidian
  const handleCopyMarkdown = () => {
    if (activeDayItems.length === 0) {
      showToast('No problems scheduled to copy.');
      return;
    }
    const md = generateMarkdownPlan(selectedDate, activeDayItems);
    navigator.clipboard.writeText(md);
    showToast('Copied study checklist to clipboard for Notion/Obsidian!');
  };

  // Add individual problem to current day
  const handleAddProblemToDay = (
    prob: { id: string; title: string; difficulty: string; links: ProblemLinks },
    topicTitle: string
  ) => {
    addToPlan(selectedDate, [
      {
        date: selectedDate,
        title: prob.title,
        type: 'problem',
        trackId: modalTrack,
        topicTitle,
        problemId: prob.id,
        difficulty: prob.difficulty,
        links: prob.links,
        completed: !!progress[prob.id],
      },
    ]);
    showToast(`Added "${prob.title}" to ${selectedDate}`);
  };

  // Add subtopic milestone goal
  const handleAddSubtopicGoal = () => {
    if (!currentSubtopic) return;
    addToPlan(selectedDate, [
      {
        date: selectedDate,
        title: currentSubtopic.title,
        type: 'topic',
        trackId: modalTrack,
        topicTitle: currentSubtopic.stepTitle || currentSubtopic.title,
        completed: false,
      },
    ]);
    showToast(`Added subtopic goal "${currentSubtopic.title}" to ${selectedDate}`);
  };

  // Add all problems in current subtopic
  const handleAddAllSubtopicProblems = () => {
    if (!currentSubtopic || currentSubtopic.problems.length === 0) return;
    const items = currentSubtopic.problems.map((prob) => ({
      date: selectedDate,
      title: prob.title,
      type: 'problem' as const,
      trackId: modalTrack,
      topicTitle: currentSubtopic.title,
      problemId: prob.id,
      difficulty: prob.difficulty,
      links: prob.links,
      completed: !!progress[prob.id],
    }));
    addToPlan(selectedDate, items);
    showToast(`Added all ${items.length} problems from "${currentSubtopic.title}" to ${selectedDate}`);
  };

  const headerDetails = formatDayHeader(selectedDate);

  return (
    <div className={styles.page}>
      {/* Toast Feedback */}
      {toastMessage && (
        <div className={styles.toastBanner}>
          <Check size={16} color="var(--difficulty-easy)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header */}
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <CalendarDays size={13} />
            <span>Smart Roadmap</span>
          </div>
          <h1 className={styles.heading}>Roadmap &amp; Daily Planner</h1>
          <p className={styles.sub}>
            Schedule your daily DSA targets, sync directly to Google Calendar,
            or export to Apple Calendar, Outlook, and Notion.
          </p>
        </div>

        <div className={styles.heroActions}>
          <button
            className={styles.smartPlannerBtn}
            onClick={() => setShowSmartPlannerModal(true)}
          >
            <Sparkles size={16} />
            <span>Pacer AI Smart Planner</span>
          </button>
          <button
            className={styles.secondaryBtn}
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            <span>Add Problem</span>
          </button>
        </div>
      </header>

      {/* Metrics Strip */}
      <section className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricTop}>
            <span>Planned for Selected Day</span>
            <CalendarDays size={15} />
          </div>
          <span className={styles.metricValue}>
            {solvedCount} / {activeDayItems.length}
          </span>
          <span className={styles.metricSub}>
            {dayCompletionPercent}% solved today
          </span>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricTop}>
            <span>Active Study Streak</span>
            <Flame
              size={15}
              color={streak > 0 ? 'var(--accent)' : 'var(--text-tertiary)'}
            />
          </div>
          <span className={styles.metricValue}>
            {streak} <span style={{ fontSize: '1rem' }}>days</span>
          </span>
          <span className={styles.metricSub}>Consecutive solve activity</span>
        </div>
      </section>

      {/* Horizontal Date Scrubber */}
      <section className={styles.scrubberContainer}>
        <div className={styles.scrubberHeader}>
          <div className={styles.scrubberNav}>
            <button
              className={styles.iconBtn}
              onClick={() => setWeekOffset((o) => o - 1)}
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className={styles.iconBtn}
              onClick={() => setWeekOffset((o) => o + 1)}
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </button>
            {weekOffset !== 0 && (
              <button
                className={styles.todayJumpBtn}
                onClick={() => {
                  setWeekOffset(0);
                  setSelectedDate(todayStr);
                }}
              >
                Jump to Today
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={styles.subtleBtn}
              onClick={handleExportWeekIcs}
              title="Export all problems this week into an .ics calendar file"
            >
              <Download size={13} />
              <span>Export Week (.ics)</span>
            </button>
          </div>
        </div>

        <div className={styles.datePillsList}>
          {weekDays.map((d) => {
            const isSelected = d.dateKey === selectedDate;
            const dayItems = planner[d.dateKey] || [];
            const isAllCompleted =
              dayItems.length > 0 &&
              dayItems.every((it) =>
                it.problemId ? progress[it.problemId] : it.completed
              );

            return (
              <div
                key={d.dateKey}
                className={`${styles.datePill} ${
                  isSelected ? styles.datePillActive : ''
                }`}
                onClick={() => setSelectedDate(d.dateKey)}
              >
                {d.isToday && (
                  <span className={styles.datePillTodayBadge}>Today</span>
                )}
                <span className={styles.pillDayName}>{d.dayName}</span>
                <span className={styles.pillDayNum}>{d.dayNum}</span>

                <div className={styles.pillIndicator}>
                  {dayItems.length > 0 ? (
                    <span
                      className={`${styles.dotCount} ${
                        isAllCompleted ? styles.dotCountCompleted : ''
                      }`}
                    >
                      {isAllCompleted ? (
                        <Check size={10} style={{ strokeWidth: 3 }} />
                      ) : (
                        dayItems.length
                      )}
                    </span>
                  ) : (
                    <span className={styles.dotEmpty} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Selected Day Content */}
      <section className={styles.daySection}>
        <div className={styles.dayHeader}>
          <div className={styles.dayTitleWrap}>
            <h2 className={styles.dayTitle}>{headerDetails.title}</h2>
            <span className={styles.daySubtitle}>{headerDetails.subtitle}</span>
          </div>

          <div className={styles.dayIntegrationsBar}>
            {activeDayItems.length > 0 && (
              <>
                <button
                  className={styles.gcalBtn}
                  onClick={handleGoogleCalendarSync}
                  title="1-Click sync to Google Calendar web intent"
                >
                  <CalendarPlus size={14} />
                  <span>Google Calendar</span>
                </button>

                <button
                  className={styles.subtleBtn}
                  onClick={handleExportIcs}
                  title="Download universal RFC 5545 .ics file for Apple Calendar / Outlook"
                >
                  <Download size={13} />
                  <span>.ics</span>
                </button>

                <button
                  className={styles.subtleBtn}
                  onClick={handleCopyMarkdown}
                  title="Copy as formatted Markdown checklist for Notion or Obsidian"
                >
                  <Copy size={13} />
                  <span>Notion / MD</span>
                </button>

                <button
                  className={styles.subtleBtn}
                  onClick={() => clearDayPlan(selectedDate)}
                  title="Clear all scheduled problems for this day"
                >
                  <Trash2 size={13} />
                  <span>Clear</span>
                </button>
              </>
            )}

            <button
              className={styles.subtleBtn}
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={13} />
              <span>Add</span>
            </button>
          </div>
        </div>

        {activeDayItems.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <CalendarDays size={24} />
            </div>
            <h3 className={styles.emptyTitle}>No problems scheduled</h3>
            <p className={styles.emptySub}>
              Keep your momentum going. Choose a sheet, select a subtopic or
              handpick problems to tackle for today.
            </p>
            <div className={styles.emptyActions}>
              <button
                className={styles.smartPlannerBtn}
                onClick={() => setShowSmartPlannerModal(true)}
              >
                <Sparkles size={15} />
                <span>Pacer AI Smart Plan</span>
              </button>
              <button
                className={styles.secondaryBtn}
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={15} />
                <span>Add Manually</span>
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.problemList}>
            {activeDayItems.map((item) => {
              const isCompleted = item.problemId
                ? !!progress[item.problemId]
                : !!item.completed;
              const trackMeta = item.trackId
                ? TRACK_META[item.trackId as TrackId]
                : null;
              const primaryLink =
                item.links?.leetcode ||
                item.links?.gfg ||
                item.links?.codestudio ||
                item.links?.practice;

              const diffClass =
                item.difficulty?.toLowerCase() === 'easy'
                  ? styles.diffEasy
                  : item.difficulty?.toLowerCase() === 'medium'
                  ? styles.diffMedium
                  : styles.diffHard;

              return (
                <div
                  key={item.id}
                  className={`${styles.problemCard} ${
                    isCompleted ? styles.problemCardCompleted : ''
                  }`}
                >
                  <div className={styles.cardLeft}>
                    <button
                      className={`${styles.checkboxBtn} ${
                        isCompleted ? styles.checkboxChecked : ''
                      }`}
                      onClick={() => togglePlanItem(selectedDate, item.id)}
                      aria-label="Toggle problem completion"
                    >
                      {isCompleted && <Check size={14} style={{ strokeWidth: 3 }} />}
                    </button>

                    <div className={styles.cardInfo}>
                      <span
                        className={`${styles.cardTitle} ${
                          isCompleted ? styles.cardTitleCompleted : ''
                        }`}
                      >
                        {item.title}
                      </span>
                      <div className={styles.cardMeta}>
                        {trackMeta && (
                          <span
                            className={`${styles.trackPill} ${
                              styles[`trackPill_${item.trackId}`] || ''
                            }`}
                          >
                            {trackMeta.shortLabel}
                          </span>
                        )}
                        <span>{item.topicTitle}</span>
                        {item.difficulty && (
                          <span className={diffClass}>{item.difficulty}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      className={styles.tutorBtn}
                      onClick={() =>
                        setTutorSession({
                          topicKey: item.topicTitle || item.trackId || 'planner',
                          topicTitle: item.topicTitle || 'DSA Strategy',
                          trackTitle: trackMeta?.label || 'Planner Roadmap',
                          item,
                        })
                      }
                      title="Open Pacer AI Tutor for this problem"
                    >
                      <Bot size={13} />
                      <span>Ask Pacer</span>
                    </button>

                    {primaryLink && (
                      <a
                        href={primaryLink}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.actionIconBtn}
                        title="Open problem in LeetCode / GeeksforGeeks"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}

                    <button
                      className={styles.actionIconBtn}
                      onClick={() => handlePushToTomorrow(item)}
                      title="Defer problem to tomorrow"
                    >
                      <ArrowRight size={14} />
                    </button>

                    <button
                      className={`${styles.actionIconBtn} ${styles.trashBtn}`}
                      onClick={() => removeFromPlan(selectedDate, item.id)}
                      title="Remove from day"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Week at a Glance Roadmap */}
      <section className={styles.roadmapSection}>
        <div className={styles.roadmapHeader}>
          <h2 className={styles.roadmapTitle}>Upcoming Roadmap</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
            Tap any day to view or edit
          </span>
        </div>

        <div className={styles.roadmapGrid}>
          {weekDays.map((d) => {
            const items = planner[d.dateKey] || [];
            const isSelected = d.dateKey === selectedDate;
            const solved = items.filter((it) =>
              it.problemId ? progress[it.problemId] : it.completed
            ).length;

            return (
              <div
                key={d.dateKey}
                className={`${styles.roadmapDayCard} ${
                  isSelected ? styles.roadmapDayCardSelected : ''
                }`}
                onClick={() => setSelectedDate(d.dateKey)}
              >
                <div className={styles.dayCardTop}>
                  <span className={styles.dayCardLabel}>
                    {d.isToday ? 'Today · ' : ''}
                    {d.dayName} {d.dayNum}
                  </span>
                  <span className={styles.dayCardCount}>
                    {items.length > 0
                      ? `${solved}/${items.length} solved`
                      : 'Free day'}
                  </span>
                </div>

                <div className={styles.dayCardList}>
                  {items.length === 0 ? (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                        fontStyle: 'italic',
                      }}
                    >
                      No tasks scheduled
                    </span>
                  ) : (
                    items.slice(0, 3).map((it) => {
                      const completed = it.problemId
                        ? !!progress[it.problemId]
                        : !!it.completed;
                      return (
                        <div
                          key={it.id}
                          className={`${styles.dayCardItem} ${
                            completed ? styles.dayCardItemCompleted : ''
                          }`}
                        >
                          <span
                            className={`${styles.itemBullet} ${
                              completed ? styles.itemBulletCompleted : ''
                            }`}
                          />
                          <span>{it.title}</span>
                        </div>
                      );
                    })
                  )}
                  {items.length > 3 && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      +{items.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pacer AI Smart Planner Modal */}
      {showSmartPlannerModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowSmartPlannerModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px' }}
          >
            <div className={styles.modalHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} color="var(--accent)" />
                  <h3 className={styles.modalTitle}>Pacer AI Smart Planner</h3>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  Intelligent algorithmic roadmap engine tailored to your timeline, curriculum &amp; target pace
                </span>
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setShowSmartPlannerModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Strategy Selector */}
              <div className={styles.formGroup}>
                <label className={styles.label}>AI Strategy Preset</label>
                <div className={styles.strategyGrid}>
                  <div
                    className={`${styles.strategyCard} ${
                      smartStrategy === 'interview_fast_track' ? styles.strategyCardActive : ''
                    }`}
                    onClick={() => setSmartStrategy('interview_fast_track')}
                  >
                    <div className={styles.strategyCardTop}>
                      <Zap size={14} color="var(--accent)" />
                      <span className={styles.strategyCardTitle}>Interview Fast-Track</span>
                    </div>
                    <span className={styles.strategyCardDesc}>
                      Top-frequency Blind 75 &amp; NC150 patterns for immediate interview readiness.
                    </span>
                  </div>

                  <div
                    className={`${styles.strategyCard} ${
                      smartStrategy === 'curriculum_mastery' ? styles.strategyCardActive : ''
                    }`}
                    onClick={() => setSmartStrategy('curriculum_mastery')}
                  >
                    <div className={styles.strategyCardTop}>
                      <GraduationCap size={14} color="var(--accent)" />
                      <span className={styles.strategyCardTitle}>Curriculum Mastery</span>
                    </div>
                    <span className={styles.strategyCardDesc}>
                      Step-by-step pedagogical order from foundational linear types to advanced DP.
                    </span>
                  </div>

                  <div
                    className={`${styles.strategyCard} ${
                      smartStrategy === 'difficulty_balanced' ? styles.strategyCardActive : ''
                    }`}
                    onClick={() => setSmartStrategy('difficulty_balanced')}
                  >
                    <div className={styles.strategyCardTop}>
                      <Scale size={14} color="var(--accent)" />
                      <span className={styles.strategyCardTitle}>Difficulty Balanced</span>
                    </div>
                    <span className={styles.strategyCardDesc}>
                      1 Easy warm-up + Medium core questions daily. Built to sustain streak without burnout.
                    </span>
                  </div>

                  <div
                    className={`${styles.strategyCard} ${
                      smartStrategy === 'weakness_focus' ? styles.strategyCardActive : ''
                    }`}
                    onClick={() => setSmartStrategy('weakness_focus')}
                  >
                    <div className={styles.strategyCardTop}>
                      <Target size={14} color="var(--accent)" />
                      <span className={styles.strategyCardTitle}>Target Weak Areas</span>
                    </div>
                    <span className={styles.strategyCardDesc}>
                      Front-loads your least-completed DSA topics to patch gaps before technical screens.
                    </span>
                  </div>
                </div>
              </div>

              {/* Curriculum Source */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Curriculum Source</label>
                <div className={styles.radioRow}>
                  <button
                    type="button"
                    className={`${styles.radioBtn} ${smartTrack === 'all' ? styles.radioBtnActive : ''}`}
                    onClick={() => setSmartTrack('all')}
                  >
                    All Sheets
                  </button>
                  {TRACK_ORDER.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`${styles.radioBtn} ${smartTrack === id ? styles.radioBtnActive : ''}`}
                      onClick={() => setSmartTrack(id)}
                    >
                      {TRACK_META[id].shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Horizon & Pace Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '12px',
                }}
              >
                <div className={styles.formGroup}>
                  <label className={styles.label}>Timeline Horizon</label>
                  <div className={styles.radioRow}>
                    {[7, 14, 30, 60].map((days) => (
                      <button
                        key={days}
                        type="button"
                        className={`${styles.radioBtn} ${
                          smartDuration === days ? styles.radioBtnActive : ''
                        }`}
                        onClick={() => setSmartDuration(days)}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Problems / Day</label>
                  <div className={styles.radioRow}>
                    {[1, 2, 3, 4, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        className={`${styles.radioBtn} ${
                          smartProblemsPerDay === cnt ? styles.radioBtnActive : ''
                        }`}
                        onClick={() => setSmartProblemsPerDay(cnt)}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Start Date</label>
                  <div className={styles.radioRow}>
                    <button
                      type="button"
                      className={`${styles.radioBtn} ${
                        smartStartOffset === 'today' ? styles.radioBtnActive : ''
                      }`}
                      onClick={() => setSmartStartOffset('today')}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className={`${styles.radioBtn} ${
                        smartStartOffset === 'tomorrow' ? styles.radioBtnActive : ''
                      }`}
                      onClick={() => setSmartStartOffset('tomorrow')}
                    >
                      Tomorrow
                    </button>
                  </div>
                </div>
              </div>

              {/* Weekly Rest / Spaced Repetition Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 2px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>Include Day 7 Weekly Review &amp; Rest:</span>
                <button
                  type="button"
                  className={`${styles.radioBtn} ${smartRestDays ? styles.radioBtnActive : ''}`}
                  onClick={() => setSmartRestDays((r) => !r)}
                  style={{ flex: 'none', padding: '4px 12px', fontSize: '0.75rem' }}
                >
                  {smartRestDays ? '✓ Enabled' : 'Disabled (Study Everyday)'}
                </button>
              </div>

              {/* Live Plan Diagnostics */}
              <div className={styles.previewStatsGrid}>
                <div className={styles.previewStatBox}>
                  <span className={styles.previewStatLabel}>Total Problems</span>
                  <span className={styles.previewStatNum}>{previewPlan.totalProblems}</span>
                </div>
                <div className={styles.previewStatBox}>
                  <span className={styles.previewStatLabel}>Difficulty Mix</span>
                  <span className={styles.previewStatNum} style={{ fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--difficulty-easy)' }}>{previewPlan.breakdown.easy}E</span> ·{' '}
                    <span style={{ color: 'var(--difficulty-medium)' }}>{previewPlan.breakdown.medium}M</span> ·{' '}
                    <span style={{ color: 'var(--difficulty-hard)' }}>{previewPlan.breakdown.hard}H</span>
                  </span>
                </div>
                <div className={styles.previewStatBox}>
                  <span className={styles.previewStatLabel}>Study Est.</span>
                  <span className={styles.previewStatNum}>{previewPlan.estimatedHoursTotal} hrs</span>
                </div>
                <div className={styles.previewStatBox}>
                  <span className={styles.previewStatLabel}>Domains</span>
                  <span className={styles.previewStatNum}>{previewPlan.topicsCovered.length} Topics</span>
                </div>
              </div>

              {/* AI Rationale & Coach Tip */}
              <div className={styles.aiRationaleBox}>
                <div className={styles.aiRationaleTitle}>
                  <Sparkles size={13} />
                  <span>AI Strategy Rationale</span>
                </div>
                <p className={styles.aiRationaleText}>{previewPlan.rationale}</p>
                <p className={styles.coachTipText}>💡 <strong>Pacer Tip:</strong> {previewPlan.coachTip}</p>
              </div>

              {/* Day-by-Day Preview Accordion/List */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  <span>Curated Schedule Preview</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                    ({previewPlan.days.length} days generated)
                  </span>
                </label>
                <div className={styles.dayPreviewList}>
                  {previewPlan.days.map((day) => (
                    <div key={day.date} className={styles.dayPreviewCard}>
                      <div className={styles.dayPreviewHeader}>
                        <span className={styles.dayPreviewName}>
                          <strong>Day {day.dayIndex}</strong> · {day.dayName}, {day.displayDate}
                        </span>
                        <span className={styles.dayPreviewTheme}>{day.theme}</span>
                      </div>
                      {day.isRestDay ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                          Rest &amp; Spaced Repetition Review
                        </div>
                      ) : (
                        <div className={styles.dayPreviewProblems}>
                          {day.problems.map((p) => (
                            <div key={p.id} className={styles.previewProbRow}>
                              <span className={styles.previewProbTitle}>
                                • {p.title}
                              </span>
                              <span
                                className={`${styles.previewDiffBadge} ${
                                  p.difficulty.toLowerCase() === 'easy'
                                    ? styles.diffEasy
                                    : p.difficulty.toLowerCase() === 'hard'
                                    ? styles.diffHard
                                    : styles.diffMedium
                                }`}
                              >
                                {p.difficulty}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Replace vs Append Mode */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 2px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>Schedule Destination:</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`${styles.radioBtn} ${
                      smartScheduleMode === 'replace' ? styles.radioBtnActive : ''
                    }`}
                    onClick={() => setSmartScheduleMode('replace')}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    Replace Dates
                  </button>
                  <button
                    type="button"
                    className={`${styles.radioBtn} ${
                      smartScheduleMode === 'append' ? styles.radioBtnActive : ''
                    }`}
                    onClick={() => setSmartScheduleMode('append')}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    Append to Dates
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.secondaryBtn}
                onClick={() => setShowSmartPlannerModal(false)}
              >
                Cancel
              </button>
              <button
                className={styles.smartPlannerBtn}
                onClick={handleApplySmartPlan}
              >
                <Sparkles size={15} />
                <span>Apply Schedule to Roadmap</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Problem & Subtopic Modal */}
      {showAddModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px' }}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>
                  Add to {headerDetails.title}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  Pick a sheet track, select its subtopic, and add problems or goals
                </span>
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Track / Sheet Selection */}
              <div className={styles.modalSelectGroup}>
                <label className={styles.modalSelectLabel}>
                  <Layers size={13} color="var(--accent)" />
                  <span>Choose Track / Sheet</span>
                </label>
                {registeredTracks.length === 0 ? (
                  <div style={{ padding: '14px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hairline)' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      You haven't registered for any tracks yet. Register for a track to plan problems from its curriculum.
                    </p>
                    <a
                      href="/settings"
                      style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      Go to Settings to Register Tracks →
                    </a>
                  </div>
                ) : (
                  <div className={styles.radioRow}>
                    {registeredTracks.map((id) => {
                      const active = modalTrack === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`${styles.radioBtn} ${
                            active ? styles.radioBtnActive : ''
                          }`}
                          onClick={() => {
                            setModalTrack(id);
                            if (id === 'a2z') {
                              setModalStepId('a2z-step-1');
                            }
                            setProblemSearch('');
                          }}
                        >
                          {TRACK_META[id].shortLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Main Topic (Step) Dropdown for A2Z only */}
              {modalTrack === 'a2z' && (
                <div className={styles.modalSelectGroup}>
                  <label className={styles.modalSelectLabel}>
                    <span>Main Topic (Step)</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                      (Filters subtopics below)
                    </span>
                  </label>
                  <select
                    className={styles.modalSelect}
                    value={modalStepId}
                    onChange={(e) => {
                      setModalStepId(e.target.value);
                      setProblemSearch('');
                    }}
                  >
                    <option value="all">All Steps (Show all subtopics)</option>
                    {a2zSteps.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subtopic Dropdown (What the user explicitly requested!) */}
              <div className={styles.modalSelectGroup}>
                <label className={styles.modalSelectLabel}>
                  <span>Select Subtopic</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>
                    • Choose subtopic to plan
                  </span>
                </label>
                <select
                  className={styles.modalSelect}
                  value={modalSubtopicId}
                  onChange={(e) => {
                    setModalSubtopicId(e.target.value);
                    setProblemSearch('');
                  }}
                >
                  {modalTrack === 'a2z' && modalStepId === 'all'
                    ? a2zSteps.map((step) => (
                        <optgroup key={step.id} label={step.title}>
                          {step.subSteps.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.title} ({sub.problems.length} problems)
                            </option>
                          ))}
                        </optgroup>
                      ))
                    : availableSubtopics.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.title} ({sub.problems.length} problems)
                        </option>
                      ))}
                </select>
              </div>

              {/* Active Subtopic Card & Actions */}
              {currentSubtopic && (
                <div className={styles.subtopicBanner}>
                  <div className={styles.subtopicHeaderRow}>
                    <div>
                      <div className={styles.subtopicTitle}>
                        <Sparkles size={14} color="var(--accent)" />
                        <span>{currentSubtopic.title}</span>
                      </div>
                      <div className={styles.subtopicMeta}>
                        <span>{currentSubtopic.stepTitle}</span>
                        <span>·</span>
                        <span>{currentSubtopic.problems.length} problems</span>
                      </div>
                    </div>

                    <div className={styles.subtopicActions}>
                      <button
                        className={styles.batchBtn}
                        onClick={handleAddSubtopicGoal}
                        title="Add this subtopic as a study topic goal"
                      >
                        <Plus size={13} />
                        <span>Add Subtopic Goal</span>
                      </button>
                      <button
                        className={`${styles.batchBtn} ${styles.batchBtnPrimary}`}
                        onClick={handleAddAllSubtopicProblems}
                        title="Add all problems in this subtopic to selected day"
                      >
                        <Plus size={13} />
                        <span>Add All ({currentSubtopic.problems.length})</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Search within this subtopic */}
              <div className={styles.modalSearchInput}>
                <Search size={15} color="var(--text-tertiary)" />
                <input
                  type="text"
                  placeholder={`Search in ${currentSubtopic ? currentSubtopic.title : 'subtopic'}...`}
                  value={problemSearch}
                  onChange={(e) => setProblemSearch(e.target.value)}
                />
                {problemSearch && (
                  <button
                    onClick={() => setProblemSearch('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Problem list inside selected subtopic */}
              <div className={styles.searchResultsList}>
                {displayedSubtopicProblems.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      color: 'var(--text-tertiary)',
                      fontSize: '0.85rem',
                    }}
                  >
                    No problems found in this subtopic.
                  </div>
                ) : (
                  displayedSubtopicProblems.map((prob) => {
                    const isAlreadyScheduled = activeDayItems.some(
                      (it) => it.problemId === prob.id
                    );
                    const isSolved = !!progress[prob.id];

                    return (
                      <div key={prob.id} className={styles.searchResultItem}>
                        <div className={styles.resultInfo}>
                          <span className={styles.resultTitle}>
                            {prob.title}
                          </span>
                          <div className={styles.resultMeta}>
                            <span
                              className={
                                prob.difficulty.toLowerCase() === 'easy'
                                  ? styles.diffEasy
                                  : prob.difficulty.toLowerCase() === 'medium'
                                  ? styles.diffMedium
                                  : styles.diffHard
                              }
                            >
                              {prob.difficulty}
                            </span>
                            {isSolved && (
                              <span
                                style={{
                                  color: 'var(--difficulty-easy)',
                                  fontWeight: 600,
                                }}
                              >
                                (Solved)
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          className={styles.addBtnSmall}
                          disabled={isAlreadyScheduled}
                          onClick={() =>
                            handleAddProblemToDay(
                              prob,
                              currentSubtopic?.title || 'DSA'
                            )
                          }
                        >
                          {isAlreadyScheduled ? 'Added' : '+ Add'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pacer AI Tutor Drawer */}
      {tutorSession && (
        <AITutorDrawer
          topicKey={tutorSession.topicKey}
          topicTitle={tutorSession.topicTitle}
          trackTitle={tutorSession.trackTitle}
          problems={[
            {
              id: tutorSession.item.problemId || tutorSession.item.id,
              title: tutorSession.item.title,
              difficulty: tutorSession.item.difficulty || 'Medium',
            },
          ]}
          currentProblem={{
            id: tutorSession.item.problemId || tutorSession.item.id,
            title: tutorSession.item.title,
            difficulty: tutorSession.item.difficulty,
          }}
          onClose={() => setTutorSession(null)}
        />
      )}
    </div>
  );
}
