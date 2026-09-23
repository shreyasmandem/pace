export type MilestoneKind = 'solves' | 'streak' | 'day' | 'rank';

export interface MilestoneStats {
  solved: number;
  bestStreak: number;
  bestDay: number;
  rank: number | null;
}

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  name: string;
  goal: string;
  emblem: string;
  emblemUnit?: string;
  current: number;
  target: number;
  unit: string;
  earned: boolean;
}

interface Definition {
  id: string;
  kind: MilestoneKind;
  name: string;
  goal: string;
  target: number;
  emblem?: string;
  emblemUnit?: string;
  unit: string;
}

const DEFINITIONS: Definition[] = [
  { id: 'solves-1', kind: 'solves', name: 'First solve', goal: 'Solve your first problem', target: 1, unit: 'solved' },
  { id: 'solves-10', kind: 'solves', name: '10 solved', goal: 'Solve 10 problems', target: 10, unit: 'solved' },
  { id: 'solves-25', kind: 'solves', name: '25 solved', goal: 'Solve 25 problems', target: 25, unit: 'solved' },
  { id: 'solves-50', kind: 'solves', name: '50 solved', goal: 'Solve 50 problems', target: 50, unit: 'solved' },
  { id: 'solves-100', kind: 'solves', name: '100 solved', goal: 'Solve 100 problems', target: 100, unit: 'solved' },
  { id: 'solves-250', kind: 'solves', name: '250 solved', goal: 'Solve 250 problems', target: 250, unit: 'solved' },
  { id: 'solves-500', kind: 'solves', name: '500 solved', goal: 'Solve 500 problems', target: 500, unit: 'solved' },
  { id: 'streak-3', kind: 'streak', name: '3-day streak', goal: 'Solve on 3 days in a row', target: 3, emblemUnit: 'days', unit: 'days' },
  { id: 'streak-7', kind: 'streak', name: '7-day streak', goal: 'Solve on 7 days in a row', target: 7, emblemUnit: 'days', unit: 'days' },
  { id: 'streak-30', kind: 'streak', name: '30-day streak', goal: 'Solve on 30 days in a row', target: 30, emblemUnit: 'days', unit: 'days' },
  { id: 'day-5', kind: 'day', name: '5 in a day', goal: 'Solve 5 problems in one day', target: 5, emblemUnit: 'a day', unit: 'in a day' },
  { id: 'day-10', kind: 'day', name: '10 in a day', goal: 'Solve 10 problems in one day', target: 10, emblemUnit: 'a day', unit: 'in a day' },
  { id: 'rank-10', kind: 'rank', name: 'Top 10', goal: 'Reach the top 10 on the leaderboard', target: 1, emblem: '10', emblemUnit: 'top', unit: '' },
];

export function computeMilestones(stats: MilestoneStats): Milestone[] {
  return DEFINITIONS.map((d) => {
    const raw =
      d.kind === 'solves'
        ? stats.solved
        : d.kind === 'streak'
          ? stats.bestStreak
          : d.kind === 'day'
            ? stats.bestDay
            : stats.rank !== null && stats.rank <= 10
              ? 1
              : 0;
    return {
      id: d.id,
      kind: d.kind,
      name: d.name,
      goal: d.goal,
      emblem: d.emblem ?? String(d.target),
      emblemUnit: d.emblemUnit,
      current: Math.min(raw, d.target),
      target: d.target,
      unit: d.unit,
      earned: raw >= d.target,
    };
  });
}

export function bestDay(solveLog: Record<string, number>): number {
  return Object.values(solveLog).reduce((max, n) => Math.max(max, n || 0), 0);
}

// Per-browser, purely cosmetic records. Losing them only replays an animation or hides a date.
// - pinned: badges that have already played their unlock animation on the badge wall
// - earnedOn: the day a badge was earned, known only for badges earned live in this browser
const PINNED_KEY = 'pace.bibsPinned';
const EARNED_ON_KEY = 'pace.bibsEarnedOn';

function readMap(key: string): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function addToMap(key: string, ids: string[], value: string): void {
  if (ids.length === 0) return;
  try {
    const map = readMap(key);
    for (const id of ids) if (!(id in map)) map[id] = value;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // Storage unavailable (private mode etc.).
  }
}

export const readSeenBadges = () => readMap(PINNED_KEY);
export const markBadgesSeen = (ids: string[]) => addToMap(PINNED_KEY, ids, '1');

export const readBadgeEarnedDates = () => readMap(EARNED_ON_KEY);
export const recordBadgesEarnedToday = (ids: string[]) =>
  addToMap(EARNED_ON_KEY, ids, new Date().toLocaleDateString('en-CA'));
