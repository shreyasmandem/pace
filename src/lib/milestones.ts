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
  bibNumber: string;
  bibUnit?: string;
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
  bibNumber?: string;
  bibUnit?: string;
  unit: string;
}

const DEFINITIONS: Definition[] = [
  { id: 'solves-1', kind: 'solves', name: 'Off the line', goal: 'Solve your first problem', target: 1, unit: 'solved' },
  { id: 'solves-10', kind: 'solves', name: 'Warmed up', goal: 'Solve 10 problems', target: 10, unit: 'solved' },
  { id: 'solves-25', kind: 'solves', name: 'First lap', goal: 'Solve 25 problems', target: 25, unit: 'solved' },
  { id: 'solves-50', kind: 'solves', name: 'Found your stride', goal: 'Solve 50 problems', target: 50, unit: 'solved' },
  { id: 'solves-100', kind: 'solves', name: 'Hundred club', goal: 'Solve 100 problems', target: 100, unit: 'solved' },
  { id: 'solves-250', kind: 'solves', name: 'Long run', goal: 'Solve 250 problems', target: 250, unit: 'solved' },
  { id: 'solves-500', kind: 'solves', name: 'Distance runner', goal: 'Solve 500 problems', target: 500, unit: 'solved' },
  { id: 'streak-3', kind: 'streak', name: 'Three in a row', goal: 'Solve on 3 days running', target: 3, bibUnit: 'days', unit: 'days' },
  { id: 'streak-7', kind: 'streak', name: 'Full week', goal: 'Solve on 7 days running', target: 7, bibUnit: 'days', unit: 'days' },
  { id: 'streak-30', kind: 'streak', name: 'Month of miles', goal: 'Solve on 30 days running', target: 30, bibUnit: 'days', unit: 'days' },
  { id: 'day-5', kind: 'day', name: 'Interval day', goal: 'Solve 5 problems in one day', target: 5, bibUnit: 'in a day', unit: 'in a day' },
  { id: 'day-10', kind: 'day', name: 'Double session', goal: 'Solve 10 problems in one day', target: 10, bibUnit: 'in a day', unit: 'in a day' },
  { id: 'rank-10', kind: 'rank', name: 'Top ten finish', goal: 'Reach the top 10 on the leaderboard', target: 1, bibNumber: 'T10', unit: '' },
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
      bibNumber: d.bibNumber ?? String(d.target),
      bibUnit: d.bibUnit,
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
// - pinned: bibs that have already played their pin-on animation on the wall
// - earnedOn: the day a bib was earned, known only for bibs earned live while using this browser
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

export const readPinnedBibs = () => readMap(PINNED_KEY);
export const markBibsPinned = (ids: string[]) => addToMap(PINNED_KEY, ids, '1');

export const readBibEarnedDates = () => readMap(EARNED_ON_KEY);
export const recordBibsEarnedToday = (ids: string[]) =>
  addToMap(EARNED_ON_KEY, ids, new Date().toLocaleDateString('en-CA'));
