import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackId } from '../types';

export type Theme = 'light' | 'dark' | 'system';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface PaceState {
  theme: Theme;
  setTheme: (t: Theme) => void;

  progress: Record<string, boolean>;
  toggleProblem: (id: string) => void;
  setManyProblems: (ids: string[], value: boolean) => void;

  notes: Record<string, string>;
  setNote: (id: string, text: string) => void;

  tutorChats: Record<string, ChatMessage[]>;
  addTutorMessage: (topicKey: string, message: { role: 'user' | 'assistant'; content: string }) => void;
  clearTutorChat: (topicKey: string) => void;

  bookmarks: Record<string, boolean>;
  toggleBookmark: (id: string) => void;

  solveLog: Record<string, number>;

  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;

  resetTrack: (problemIds: string[]) => void;
  resetAll: () => void;

  exportSnapshot: () => string;
  importSnapshot: (json: string) => boolean;
}

export const usePaceStore = create<PaceState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),

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
      resetAll: () =>
        set({
          progress: {},
          notes: {},
          bookmarks: {},
          solveLog: {},
          tutorChats: {},
        }),

      exportSnapshot: () => {
        const { progress, notes, bookmarks, solveLog, tutorChats } = get();
        return JSON.stringify(
          { exportedAt: new Date().toISOString(), progress, notes, bookmarks, solveLog, tutorChats: tutorChats || {} },
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
        progress: state.progress,
        notes: state.notes,
        tutorChats: state.tutorChats || {},
        bookmarks: state.bookmarks,
        solveLog: state.solveLog,
      }),
      merge: (persistedState: any, currentState: PaceState) => ({
        ...currentState,
        ...(persistedState || {}),
        progress: persistedState?.progress ?? {},
        notes: persistedState?.notes ?? {},
        tutorChats: persistedState?.tutorChats ?? {},
        bookmarks: persistedState?.bookmarks ?? {},
        solveLog: persistedState?.solveLog ?? {},
      }),
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
