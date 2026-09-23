import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag, Flame, X } from 'lucide-react';
import { ALL_TRACKS, TRACK_META, TRACK_ORDER, getAllProblems } from '../data';
import { usePaceStore, currentStreak } from '../state/store';
import { longestStreak } from '../lib/leaderboard';
import { bestDay, computeMilestones, recordBibsEarnedToday, type Milestone } from '../lib/milestones';
import { consumeUserSolveIntent } from '../lib/celebrate';
import { MiniBib } from './RaceBib';
import styles from './Celebrations.module.css';

type PaceState = ReturnType<typeof usePaceStore.getState>;

type ToastBody =
  | { kind: 'streak'; streak: number }
  | { kind: 'topic'; topic: string; count: number; color: string }
  | { kind: 'bib'; milestone: Milestone };

type Toast = ToastBody & { id: number; leaving?: boolean };

const MAX_VISIBLE = 3;
const TOAST_MS = { streak: 4500, topic: 5000, bib: 6500 } as const;

function milestonesFor(state: PaceState): Milestone[] {
  const progress = state.progress || {};
  const solveLog = state.solveLog || {};
  let solved = 0;
  for (const trackId of state.registeredTracks || []) {
    for (const p of getAllProblems(trackId)) if (progress[p.id]) solved += 1;
  }
  return computeMilestones({
    solved,
    bestStreak: Math.max(currentStreak(solveLog), longestStreak(solveLog)),
    bestDay: bestDay(solveLog),
    rank: null,
  });
}

function clearedTopic(state: PaceState, problemId: string): ToastBody | null {
  const registered = state.registeredTracks || [];
  const order = [...registered, ...TRACK_ORDER.filter((id) => !registered.includes(id))];
  for (const trackId of order) {
    const group = ALL_TRACKS[trackId]?.groups.find((g) => g.problems.some((p) => p.id === problemId));
    if (!group) continue;
    if (group.problems.length >= 2 && group.problems.every((p) => state.progress[p.id])) {
      return { kind: 'topic', topic: group.title, count: group.problems.length, color: TRACK_META[trackId].accent };
    }
    return null;
  }
  return null;
}

export default function Celebrations() {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 180);
  }, []);

  const push = useCallback(
    (bodies: ToastBody[]) => {
      if (bodies.length === 0) return;
      const created = bodies.map((b) => ({ ...b, id: nextId.current++ }) as Toast);
      setToasts((all) => [...all, ...created].slice(-MAX_VISIBLE));
      for (const t of created) window.setTimeout(() => dismiss(t.id), TOAST_MS[t.kind]);
    },
    [dismiss]
  );

  useEffect(() => {
    let prev = usePaceStore.getState();
    let prevEarned = new Set(milestonesFor(prev).filter((m) => m.earned).map((m) => m.id));

    return usePaceStore.subscribe((state) => {
      const before = prev;
      prev = state;
      if (
        state.progress === before.progress &&
        state.solveLog === before.solveLog &&
        state.registeredTracks === before.registeredTracks
      ) {
        return;
      }

      const milestones = milestonesFor(state);
      const newlyEarned = milestones.filter((m) => m.earned && !prevEarned.has(m.id));
      prevEarned = new Set(milestones.filter((m) => m.earned).map((m) => m.id));

      const problemId = consumeUserSolveIntent();
      if (!problemId || !state.progress[problemId]) return;

      const bodies: ToastBody[] = [];

      const topic = clearedTopic(state, problemId);
      if (topic) bodies.push(topic);

      const beforeLog = before.solveLog || {};
      const firstSolveToday = Object.keys(state.solveLog || {}).some((day) => !beforeLog[day]);
      if (firstSolveToday) bodies.push({ kind: 'streak', streak: currentStreak(state.solveLog) });

      if (newlyEarned.length > 0) {
        recordBibsEarnedToday(newlyEarned.map((m) => m.id));
        for (const m of newlyEarned.slice(-2)) bodies.push({ kind: 'bib', milestone: m });
      }

      push(bodies);
    });
  }, [push]);

  return (
    <div className={styles.stack} aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${t.leaving ? styles.leaving : ''}`} role="status">
          {t.kind === 'streak' && (
            <>
              <span className={`${styles.iconChip} ${styles.flameChip}`}>
                <Flame size={18} className={styles.flame} />
              </span>
              <span className={styles.text}>
                <strong>{t.streak >= 2 ? `${t.streak}-day streak` : 'Day one'}</strong>
                <span>
                  {t.streak >= 2 ? "Today's solve is in. See you tomorrow." : 'Solve one tomorrow and it becomes a streak.'}
                </span>
              </span>
            </>
          )}

          {t.kind === 'topic' && (
            <>
              <span className={styles.iconChip} style={{ color: t.color }}>
                <Flag size={17} className={styles.flag} />
              </span>
              <span className={styles.text}>
                <strong>Topic cleared</strong>
                <span>
                  {t.topic}, all {t.count} problems.
                </span>
              </span>
            </>
          )}

          {t.kind === 'bib' && (
            <>
              <span className={styles.bibSlot}>
                <MiniBib milestone={t.milestone} />
              </span>
              <span className={styles.text}>
                <strong>New bib: {t.milestone.name}</strong>
                <span>Pinned to your wall.</span>
              </span>
              <button
                className={styles.action}
                onClick={() => {
                  dismiss(t.id);
                  navigate('/stats');
                }}
              >
                See it
              </button>
            </>
          )}

          <button className={styles.close} onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
