import { useEffect } from 'react';
import { getAllProblems } from '../data';
import { usePaceStore, currentStreak } from '../state/store';
import { longestStreak } from '../lib/leaderboard';
import { bestDay, computeMilestones, recordBadgesEarnedToday, type Milestone } from '../lib/milestones';

type PaceState = ReturnType<typeof usePaceStore.getState>;

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

export default function Celebrations() {
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

      if (newlyEarned.length > 0) {
        recordBadgesEarnedToday(newlyEarned.map((m) => m.id));
      }
    });
  }, []);

  return null;
}
