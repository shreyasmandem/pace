import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackId } from '../types';
import { getTrack } from '../data';

export type Theme = 'light' | 'dark' | 'system';

export type TutorLanguage =
  | 'python'
  | 'cpp'
  | 'java'
  | 'javascript'
  | 'typescript'
  | 'go'
  | 'rust'
  | 'neutral';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface PlanItem {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'topic' | 'problem';
  trackId?: string;
  topicTitle: string;
  problemId?: string;
  difficulty?: string;
  links?: {
    leetcode?: string | null;
    gfg?: string | null;
    codestudio?: string | null;
    youtube?: string | null;
    neetcode?: string | null;
    article?: string | null;
    practice?: string | null;
  };
  completed?: boolean;
}

interface PaceState {
  theme: Theme;
  setTheme: (t: Theme) => void;

  tutorLanguage: TutorLanguage;
  setTutorLanguage: (lang: TutorLanguage) => void;

  progress: Record<string, boolean>;
  toggleProblem: (id: string) => void;
  setManyProblems: (ids: string[], value: boolean) => void;

  notes: Record<string, string>;
  setNote: (id: string, text: string) => void;

  tutorChats: Record<string, ChatMessage[]>;
  addTutorMessage: (topicKey: string, message: { role: 'user' | 'assistant'; content: string }) => void;
  clearTutorChat: (topicKey: string) => void;
  clearAllTutorChats: () => void;

  bookmarks: Record<string, boolean>;
  toggleBookmark: (id: string) => void;

  solveLog: Record<string, number>;

  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  planner: Record<string, PlanItem[]>;
  addToPlan: (date: string, items: Omit<PlanItem, 'id'>[]) => void;
  removeFromPlan: (date: string, itemId: string) => void;
  togglePlanItem: (date: string, itemId: string) => void;
  movePlanItem: (fromDay: string, toDay: string, itemId: string) => void;
  clearDayPlan: (date: string) => void;
  autoGeneratePlan: (trackId: TrackId, startDate: string, daysCount: number, problemsPerDay: number) => void;

  registeredTracks: TrackId[];
  registerTrack: (trackId: TrackId) => void;
  unregisterTrack: (trackId: TrackId) => void;
  isRegistered: (trackId: TrackId) => boolean;

  resetTrack: (problemIds: string[]) => void;
  resetAll: () => void;

  exportSnapshot: () => string;
  importSnapshot: (json: string) => boolean;
}

const RESET_PROGRESS_V2_KEY = 'pace_progress_reset_v2_registration';

function checkAndPerformGlobalReset(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const done = localStorage.getItem(RESET_PROGRESS_V2_KEY);
    if (!done) {
      localStorage.setItem(RESET_PROGRESS_V2_KEY, 'true');
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

const shouldResetProgressOnLoad = checkAndPerformGlobalReset();

export const usePaceStore = create<PaceState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      tutorLanguage: 'python',
      setTutorLanguage: (tutorLanguage) => set({ tutorLanguage }),

      registeredTracks: [],
      registerTrack: (trackId) =>
        set((state) => {
          const current = state.registeredTracks || [];
          if (current.includes(trackId)) return state;
          return { registeredTracks: [...current, trackId] };
        }),
      unregisterTrack: (trackId) =>
        set((state) => {
          const current = state.registeredTracks || [];
          const nextRegistered = current.filter((id) => id !== trackId);

          const track = getTrack(trackId);
          const trackProblemIds = new Set<string>();
          if (track) {
            for (const group of track.groups) {
              for (const p of group.problems) {
                trackProblemIds.add(p.id);
              }
            }
          }

          const progress = { ...state.progress };
          const notes = { ...state.notes };
          const bookmarks = { ...state.bookmarks };

          for (const id of trackProblemIds) {
            delete progress[id];
            delete notes[id];
            delete bookmarks[id];
          }

          const planner = { ...state.planner };
          for (const [day, items] of Object.entries(planner)) {
            planner[day] = items.filter(
              (it) => it.trackId !== trackId && (!it.problemId || !trackProblemIds.has(it.problemId))
            );
          }

          return {
            registeredTracks: nextRegistered,
            progress,
            notes,
            bookmarks,
            planner,
          };
        }),
      isRegistered: (trackId) => {
        return (get().registeredTracks || []).includes(trackId);
      },

      progress: {},
      toggleProblem: (id) =>
        set((state) => {
          const next = !state.progress[id];
          const log = { ...state.solveLog };
          const day = todayISO();
          log[day] = (log[day] || 0) + (next ? 1 : -1);
          if (log[day] <= 0) delete log[day];
          const progress = { ...state.progress };
          if (next) {
            progress[id] = true;
          } else {
            delete progress[id];
          }
          return {
            progress,
            solveLog: log,
          };
        }),
      setManyProblems: (ids, value) =>
        set((state) => {
          const progress = { ...state.progress };
          for (const id of ids) {
            if (value) progress[id] = true;
            else delete progress[id];
          }
          return { progress };
        }),

      notes: {},
      setNote: (id, text) =>
        set((state) => {
          const notes = { ...state.notes };
          if (text.trim()) notes[id] = text;
          else delete notes[id];
          return { notes };
        }),

      tutorChats: {},
      addTutorMessage: (topicKey, message) =>
        set((state) => {
          const tutorChats = state.tutorChats || {};
          const current = tutorChats[topicKey] || [];
          const newMessage: ChatMessage = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            role: message.role,
            content: message.content,
            timestamp: Date.now(),
          };
          return {
            tutorChats: {
              ...tutorChats,
              [topicKey]: [...current, newMessage],
            },
          };
        }),
      clearTutorChat: (topicKey) =>
        set((state) => {
          const tutorChats = { ...(state.tutorChats || {}) };
          delete tutorChats[topicKey];
          return { tutorChats };
        }),
      clearAllTutorChats: () =>
        set({ tutorChats: {} }),

      bookmarks: {},
      toggleBookmark: (id) =>
        set((state) => {
          const bookmarks = { ...state.bookmarks };
          if (bookmarks[id]) delete bookmarks[id];
          else bookmarks[id] = true;
          return { bookmarks };
        }),

      solveLog: {},

      searchOpen: false,
      setSearchOpen: (v) => set({ searchOpen: v }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

      planner: {},
      addToPlan: (date, items) =>
        set((state) => {
          const planner = { ...(state.planner || {}) };
          const existing = planner[date] || [];
          const newItems: PlanItem[] = items.map((it) => ({
            ...it,
            id: 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            completed: it.problemId ? !!state.progress[it.problemId] : !!it.completed,
          }));
          planner[date] = [...existing, ...newItems];
          return { planner };
        }),

      removeFromPlan: (date, itemId) =>
        set((state) => {
          const planner = { ...(state.planner || {}) };
          if (!planner[date]) return state;
          planner[date] = planner[date].filter((it) => it.id !== itemId);
          if (planner[date].length === 0) delete planner[date];
          return { planner };
        }),

      togglePlanItem: (date, itemId) =>
        set((state) => {
          const planner = { ...(state.planner || {}) };
          const list = planner[date];
          if (!list) return state;
          const target = list.find((it) => it.id === itemId);
          if (!target) return state;

          const nextCompleted = !target.completed;
          planner[date] = list.map((it) =>
            it.id === itemId ? { ...it, completed: nextCompleted } : it
          );

          if (target.problemId) {
            const progress = { ...state.progress };
            const log = { ...state.solveLog };
            const day = todayISO();

            if (nextCompleted) {
              progress[target.problemId] = true;
              log[day] = (log[day] || 0) + 1;
            } else {
              delete progress[target.problemId];
              log[day] = (log[day] || 0) - 1;
              if (log[day] <= 0) delete log[day];
            }
            return { planner, progress, solveLog: log };
          }

          return { planner };
        }),

      movePlanItem: (fromDay, toDay, itemId) =>
        set((state) => {
          const planner = { ...(state.planner || {}) };
          const sourceList = planner[fromDay] || [];
          const item = sourceList.find((it) => it.id === itemId);
          if (!item) return state;

          planner[fromDay] = sourceList.filter((it) => it.id !== itemId);
          if (planner[fromDay].length === 0) delete planner[fromDay];

          const targetList = planner[toDay] || [];
          planner[toDay] = [...targetList, { ...item, date: toDay }];
          return { planner };
        }),

      clearDayPlan: (date) =>
        set((state) => {
          const planner = { ...(state.planner || {}) };
          delete planner[date];
          return { planner };
        }),

      autoGeneratePlan: (trackId, startDate, daysCount, problemsPerDay) =>
        set((state) => {
          const track = getTrack(trackId);
          if (!track) return state;

          const unsolved: Array<{ problem: any; topicTitle: string }> = [];
          for (const group of track.groups) {
            for (const p of group.problems) {
              if (!state.progress[p.id]) {
                unsolved.push({ problem: p, topicTitle: group.title });
              }
            }
          }

          const planner = { ...(state.planner || {}) };
          const [y, m, d] = startDate.split('-').map(Number);
          const cursor = new Date(y, m - 1, d);

          let index = 0;
          for (let dayOffset = 0; dayOffset < daysCount; dayOffset++) {
            if (index >= unsolved.length) break;

            const dayDate = new Date(cursor.getTime() + dayOffset * 86400000);
            const dayIso = dayDate.toISOString().slice(0, 10);

            const dailyBatch = unsolved.slice(index, index + problemsPerDay);
            index += dailyBatch.length;

            const items: PlanItem[] = dailyBatch.map(({ problem, topicTitle }) => ({
              id: 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
              date: dayIso,
              title: problem.title,
              type: 'problem',
              trackId,
              topicTitle,
              problemId: problem.id,
              difficulty: problem.difficulty,
              links: problem.links,
              completed: false,
            }));

            planner[dayIso] = [...(planner[dayIso] || []), ...items];
          }

          return { planner };
        }),

      resetTrack: (problemIds) =>
        set((state) => {
          const progress = { ...state.progress };
          const notes = { ...state.notes };
          const bookmarks = { ...state.bookmarks };
          for (const id of problemIds) {
            delete progress[id];
            delete notes[id];
            delete bookmarks[id];
          }
          return { progress, notes, bookmarks };
        }),
      resetAll: () => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const toRemove: string[] = [];
            for (let i = 0; i < window.localStorage.length; i++) {
              const k = window.localStorage.key(i);
              if (
                k &&
                (k.startsWith('pacer_') ||
                  k.startsWith('pace_tutor') ||
                  k.includes('chat') ||
                  k.includes('tutor'))
              ) {
                toRemove.push(k);
              }
            }
            toRemove.forEach((k) => window.localStorage.removeItem(k));
          }
        } catch {
          // ignore
        }

        set({
          progress: {},
          notes: {},
          bookmarks: {},
          solveLog: {},
          tutorChats: {},
          planner: {},
          registeredTracks: [],
        });
      },

      exportSnapshot: () => {
        const { progress, notes, bookmarks, solveLog, tutorChats, planner, registeredTracks, tutorLanguage } = get();
        return JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            progress,
            notes,
            bookmarks,
            solveLog,
            tutorChats: tutorChats || {},
            planner: planner || {},
            registeredTracks: registeredTracks || [],
            tutorLanguage: tutorLanguage || 'python',
          },
          null,
          2
        );
      },
      importSnapshot: (json) => {
        try {
          const parsed = JSON.parse(json);
          if (typeof parsed !== 'object' || parsed === null) return false;
          set({
            progress: parsed.progress ?? {},
            notes: parsed.notes ?? {},
            bookmarks: parsed.bookmarks ?? {},
            solveLog: parsed.solveLog ?? {},
            tutorChats: parsed.tutorChats ?? {},
            planner: parsed.planner ?? {},
            registeredTracks: Array.isArray(parsed.registeredTracks) ? parsed.registeredTracks : [],
            tutorLanguage: parsed.tutorLanguage ?? 'python',
          });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'pace-store',
      partialize: (state) => ({
        theme: state.theme,
        tutorLanguage: state.tutorLanguage || 'python',
        progress: state.progress,
        notes: state.notes,
        tutorChats: state.tutorChats || {},
        bookmarks: state.bookmarks,
        solveLog: state.solveLog,
        planner: state.planner || {},
        registeredTracks: state.registeredTracks || [],
      }),
      merge: (persistedState: any, currentState: PaceState) => {
        if (shouldResetProgressOnLoad) {
          return {
            ...currentState,
            theme: persistedState?.theme ?? currentState.theme,
            tutorLanguage: persistedState?.tutorLanguage ?? 'python',
            progress: {},
            notes: persistedState?.notes ?? {},
            tutorChats: persistedState?.tutorChats ?? {},
            bookmarks: persistedState?.bookmarks ?? {},
            solveLog: {},
            planner: persistedState?.planner ?? {},
            registeredTracks: [],
          };
        }
        return {
          ...currentState,
          ...(persistedState || {}),
          tutorLanguage: persistedState?.tutorLanguage ?? 'python',
          progress: persistedState?.progress ?? {},
          notes: persistedState?.notes ?? {},
          tutorChats: persistedState?.tutorChats ?? {},
          bookmarks: persistedState?.bookmarks ?? {},
          solveLog: persistedState?.solveLog ?? {},
          planner: persistedState?.planner ?? {},
          sidebarCollapsed: Boolean(persistedState?.sidebarCollapsed),
          registeredTracks: Array.isArray(persistedState?.registeredTracks)
            ? persistedState.registeredTracks
            : [],
        };
      },
    }
  )
);

export function trackProgressCount(progress: Record<string, boolean>, problemIds: string[]): number {
  let n = 0;
  for (const id of problemIds) if (progress[id]) n += 1;
  return n;
}

export function currentStreak(solveLog: Record<string, number>): number {
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const iso = cursor.toISOString().slice(0, 10);
    if (solveLog[iso]) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (streak === 0 && iso === todayISO()) {
      // Today not solved yet doesn't break a streak that started yesterday.
      cursor.setDate(cursor.getDate() - 1);
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export type { TrackId };
