import { useMemo } from 'react';
import {
  getAllProblems,
  TRACK_ORDER,
  getVisibleTrackOrder,
  filterVisibleTracks,
} from '../data';
import { usePaceStore } from '../state/store';
import { useAuthUser } from './useAuth';
import { isPaceAdmin } from '../lib/admin';
import type { TrackId } from '../types';

export interface TrackStat {
  id: TrackId;
  total: number;
  solved: number;
  percent: number;
}

export function useVisibleTracks() {
  const { user, loading } = useAuthUser();
  const isAdmin = isPaceAdmin(user);
  const rawRegisteredTracks = usePaceStore((s) => s.registeredTracks || []);

  const visibleTrackOrder = useMemo(() => getVisibleTrackOrder(isAdmin), [isAdmin]);
  const visibleRegisteredTracks = useMemo(
    () => filterVisibleTracks(rawRegisteredTracks, isAdmin),
    [rawRegisteredTracks, isAdmin]
  );

  return {
    isAdmin,
    authLoading: loading,
    visibleTrackOrder,
    visibleRegisteredTracks,
  };
}

export function useTrackStats(): Record<TrackId, TrackStat> {
  const progress = usePaceStore((s) => s.progress);

  return useMemo(() => {
    const out = {} as Record<TrackId, TrackStat>;
    for (const id of TRACK_ORDER) {
      const problems = getAllProblems(id);
      const solved = problems.reduce((n, p) => n + (progress[p.id] ? 1 : 0), 0);
      out[id] = {
        id,
        total: problems.length,
        solved,
        percent: problems.length ? (solved / problems.length) * 100 : 0,
      };
    }
    return out;
  }, [progress]);
}

export interface DifficultyBreakdown {
  easy: { solved: number; total: number };
  medium: { solved: number; total: number };
  hard: { solved: number; total: number };
}

export function useDifficultyBreakdown(trackId: TrackId): DifficultyBreakdown {
  const progress = usePaceStore((s) => s.progress);

  return useMemo(() => {
    const out: DifficultyBreakdown = {
      easy: { solved: 0, total: 0 },
      medium: { solved: 0, total: 0 },
      hard: { solved: 0, total: 0 },
    };
    for (const p of getAllProblems(trackId)) {
      const bucket =
        p.difficulty === 'Easy' ? out.easy : p.difficulty === 'Medium' ? out.medium : p.difficulty === 'Hard' ? out.hard : null;
      if (!bucket) continue;
      bucket.total += 1;
      if (progress[p.id]) bucket.solved += 1;
    }
    return out;
  }, [trackId, progress]);
}

export function useAggregateStat() {
  const stats = useTrackStats();
  const { visibleRegisteredTracks } = useVisibleTracks();

  return useMemo(() => {
    if (visibleRegisteredTracks.length === 0) {
      return { total: 0, solved: 0, percent: 0 };
    }
    const values = visibleRegisteredTracks.map((id) => stats[id]).filter(Boolean);
    const total = values.reduce((n, s) => n + s.total, 0);
    const solved = values.reduce((n, s) => n + s.solved, 0);
    return { total, solved, percent: total ? (solved / total) * 100 : 0 };
  }, [stats, visibleRegisteredTracks]);
}
