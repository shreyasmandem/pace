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
  BookOpen,
} from 'lucide-react';
import { usePaceStore, currentStreak, type PlanItem } from '../state/store';
import { ALL_TRACKS, TRACK_META, TRACK_ORDER } from '../data';
import type { TrackId, ProblemLinks } from '../types';
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
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Auto-pace form state
  const [autoTrack, setAutoTrack] = useState<TrackId>('a2z');
  const [autoDays, setAutoDays] = useState<number>(7);
  const [autoPerDay, setAutoPerDay] = useState<number>(3);
  const [autoStartOffset, setAutoStartOffset] = useState<'today' | 'tomorrow'>('today');

  // Add problem modal search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTrack, setFilterTrack] = useState<string>('all');
  const [filterDiff, setFilterDiff] = useState<string>('all');

  // AI Tutor Drawer session
  const [tutorSession, setTutorSession] = useState<{
    topicKey: string;
    topicTitle: string;
    trackTitle: string;
    item: PlanItem;
  } | null>(null);

  // Store data & actions
  const planner = usePaceStore((s) => s.planner || {});
  const progress = usePaceStore((s) => s.progress || {});
  const solveLog = usePaceStore((s) => s.solveLog || {});
  const streak = currentStreak(solveLog);

  const togglePlanItem = usePaceStore((s) => s.togglePlanItem);
  const removeFromPlan = usePaceStore((s) => s.removeFromPlan);
  const movePlanItem = usePaceStore((s) => s.movePlanItem);
  const clearDayPlan = usePaceStore((s) => s.clearDayPlan);
  const autoGeneratePlan = usePaceStore((s) => s.autoGeneratePlan);
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

  // Flatten all track problems for manual search/picker
  const allProblems = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      difficulty: string;
      trackId: TrackId;
      trackLabel: string;
      topicTitle: string;
      links: ProblemLinks;
    }> = [];

    for (const trackId of TRACK_ORDER) {
      const track = ALL_TRACKS[trackId];
      if (!track) continue;
      const meta = TRACK_META[trackId];
      for (const group of track.groups) {
        for (const prob of group.problems) {
          list.push({
            id: prob.id,
            title: prob.title,
            difficulty: prob.difficulty,
            trackId,
            trackLabel: meta.shortLabel,
            topicTitle: group.title,
            links: prob.links,
          });
        }
      }
    }
    return list;
  }, []);

  // Filtered problems for Add Problem modal
  const filteredProblems = useMemo(() => {
    let result = allProblems;

    if (filterTrack !== 'all') {
      result = result.filter((p) => p.trackId === filterTrack);
    }

    if (filterDiff !== 'all') {
      result = result.filter(
        (p) => p.difficulty.toLowerCase() === filterDiff.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.topicTitle.toLowerCase().includes(q)
      );
    }

    return result.slice(0, 40);
  }, [allProblems, filterTrack, filterDiff, searchQuery]);

  // Day items & stats
  const activeDayItems = planner[selectedDate] || [];
  const solvedCount = activeDayItems.filter((it) =>
    it.problemId ? progress[it.problemId] : it.completed
  ).length;
  const dayCompletionPercent =
    activeDayItems.length > 0
      ? Math.round((solvedCount / activeDayItems.length) * 100)
      : 0;

  // Total problems across all days in planner
  const totalPlannedProblems = useMemo(() => {
    return Object.values(planner).reduce(
      (acc, items) => acc + (items?.length || 0),
      0
    );
  }, [planner]);

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

  // Execute Auto-Pace
  const handleExecuteAutoPace = () => {
    const base = new Date();
    if (autoStartOffset === 'tomorrow') {
      base.setDate(base.getDate() + 1);
    }
    const startDate = toDateKey(base);

    autoGeneratePlan(autoTrack, startDate, autoDays, autoPerDay);
    setShowAutoModal(false);
    setSelectedDate(startDate);
    showToast(
      `Auto-scheduled ${autoDays * autoPerDay} problems from ${TRACK_META[autoTrack].shortLabel}!`
    );
  };

  // Add individual problem to current day
  const handleAddProblemToDay = (prob: (typeof allProblems)[0]) => {
    addToPlan(selectedDate, [
      {
        date: selectedDate,
        title: prob.title,
        type: 'problem',
        trackId: prob.trackId,
        topicTitle: prob.topicTitle,
        problemId: prob.id,
        difficulty: prob.difficulty,
        links: prob.links,
        completed: !!progress[prob.id],
      },
    ]);
    showToast(`Added "${prob.title}" to ${selectedDate}`);
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
            className={styles.primaryBtn}
            onClick={() => setShowAutoModal(true)}
          >
            <Sparkles size={16} />
            <span>Auto-Pace Routine</span>
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

        <div className={styles.metricCard}>
          <div className={styles.metricTop}>
            <span>Total Roadmap Items</span>
            <BookOpen size={15} />
          </div>
          <span className={styles.metricValue}>{totalPlannedProblems}</span>
          <span className={styles.metricSub}>Across all scheduled days</span>
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
              Keep your momentum going. Auto-generate the next questions from
              your roadmap or handpick problems to tackle.
            </p>
            <div className={styles.emptyActions}>
              <button
                className={styles.primaryBtn}
                onClick={() => setShowAutoModal(true)}
              >
                <Sparkles size={15} />
                <span>Auto-Pace My Day</span>
              </button>
              <button
                className={styles.secondaryBtn}
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={15} />
                <span>Choose Problems</span>
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

      {/* Auto-Pace Modal */}
      {showAutoModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowAutoModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={18} color="var(--accent)" />
                <h3 className={styles.modalTitle}>Auto-Pace My DSA Routine</h3>
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setShowAutoModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Select Track</label>
                <div className={styles.trackSelectGrid}>
                  {TRACK_ORDER.map((id) => {
                    const meta = TRACK_META[id];
                    const active = autoTrack === id;
                    return (
                      <div
                        key={id}
                        className={`${styles.trackOption} ${
                          active ? styles.trackOptionActive : ''
                        }`}
                        onClick={() => setAutoTrack(id)}
                      >
                        <span className={styles.trackOptName}>
                          {meta.shortLabel}
                        </span>
                        <span className={styles.trackOptSub}>
                          {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Daily Target (problems/day)</label>
                <div className={styles.radioRow}>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`${styles.radioBtn} ${
                        autoPerDay === num ? styles.radioBtnActive : ''
                      }`}
                      onClick={() => setAutoPerDay(num)}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Schedule Duration</label>
                <div className={styles.radioRow}>
                  {[3, 5, 7, 14].map((days) => (
                    <button
                      key={days}
                      type="button"
                      className={`${styles.radioBtn} ${
                        autoDays === days ? styles.radioBtnActive : ''
                      }`}
                      onClick={() => setAutoDays(days)}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Start From</label>
                <div className={styles.radioRow}>
                  <button
                    type="button"
                    className={`${styles.radioBtn} ${
                      autoStartOffset === 'today' ? styles.radioBtnActive : ''
                    }`}
                    onClick={() => setAutoStartOffset('today')}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={`${styles.radioBtn} ${
                      autoStartOffset === 'tomorrow' ? styles.radioBtnActive : ''
                    }`}
                    onClick={() => setAutoStartOffset('tomorrow')}
                  >
                    Tomorrow
                  </button>
                </div>
              </div>

              <div className={styles.summaryBox}>
                ✨ Pace will curate{' '}
                <strong>{autoDays * autoPerDay} unsolved problems</strong> in
                sequential order from{' '}
                <strong>{TRACK_META[autoTrack].label}</strong>, evenly
                distributing {autoPerDay} problems each day across {autoDays}{' '}
                days starting {autoStartOffset}.
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.secondaryBtn}
                onClick={() => setShowAutoModal(false)}
              >
                Cancel
              </button>
              <button
                className={styles.primaryBtn}
                onClick={handleExecuteAutoPace}
              >
                <Sparkles size={15} />
                <span>Generate Schedule</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Problem Modal */}
      {showAddModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '620px' }}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                Add Problem to {headerDetails.title}
              </h3>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalSearchInput}>
                <Search size={16} color="var(--text-tertiary)" />
                <input
                  type="text"
                  placeholder="Search 800+ problems by name or topic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
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

              {/* Filters */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className={`${styles.radioBtn} ${
                    filterTrack === 'all' ? styles.radioBtnActive : ''
                  }`}
                  onClick={() => setFilterTrack('all')}
                  style={{ flex: 'none', padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  All Sheets
                </button>
                {TRACK_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.radioBtn} ${
                      filterTrack === id ? styles.radioBtnActive : ''
                    }`}
                    onClick={() => setFilterTrack(id)}
                    style={{
                      flex: 'none',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                    }}
                  >
                    {TRACK_META[id].shortLabel}
                  </button>
                ))}
              </div>

              {/* Problem search list */}
              <div className={styles.searchResultsList}>
                {filteredProblems.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      color: 'var(--text-tertiary)',
                      fontSize: '0.85rem',
                    }}
                  >
                    No matching problems found.
                  </div>
                ) : (
                  filteredProblems.map((prob) => {
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
                            <span>{prob.trackLabel}</span>
                            <span>·</span>
                            <span>{prob.topicTitle}</span>
                            <span>·</span>
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
                          onClick={() => handleAddProblemToDay(prob)}
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
