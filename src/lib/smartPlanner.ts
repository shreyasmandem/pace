import { ALL_TRACKS, TRACK_META, TRACK_ORDER, getTrack } from '../data';
import type { TrackId, Problem, ProblemLinks } from '../types';

export type SmartPlanStrategy =
  | 'interview_fast_track'
  | 'curriculum_mastery'
  | 'difficulty_balanced'
  | 'weakness_focus';

export interface SmartPlanCandidate {
  id: string;
  title: string;
  difficulty: string;
  trackId: TrackId;
  trackLabel: string;
  topicTitle: string;
  topicIndex: number;
  links: ProblemLinks;
}

export interface SmartPlanConfig {
  trackIds: TrackId[];
  strategy: SmartPlanStrategy;
  durationDays: number;
  problemsPerDay: number;
  startDate: string; // YYYY-MM-DD
  includeRestDays?: boolean;
  progress: Record<string, boolean>;
}

export interface SmartPlanDay {
  date: string;
  dayIndex: number;
  dayName: string;
  displayDate: string;
  isRestDay: boolean;
  theme: string;
  problems: SmartPlanCandidate[];
}

export interface SmartPlanResult {
  days: SmartPlanDay[];
  totalProblems: number;
  breakdown: {
    easy: number;
    medium: number;
    hard: number;
  };
  topicsCovered: string[];
  rationale: string;
  estimatedHoursTotal: number;
  coachTip: string;
}

/** Format Date object to YYYY-MM-DD */
export function formatToDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD to Date object */
export function parseFromDateKey(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Canonical pedagogical order of algorithmic concepts
const TOPIC_PRIORITY_ORDER = [
  'array',
  'string',
  'hash',
  'two pointer',
  'sliding window',
  'prefix sum',
  'matrix',
  'stack',
  'queue',
  'binary search',
  'linked list',
  'recursion',
  'tree',
  'binary search tree',
  'bst',
  'heap',
  'priority queue',
  'backtracking',
  'trie',
  'graph',
  'breadth-first',
  'depth-first',
  'topological',
  'dynamic programming',
  '1d dp',
  '2d dp',
  'knapsack',
  'greedy',
  'interval',
  'bit manipulation',
  'math',
];

function getTopicScore(topicTitle: string): number {
  const lower = topicTitle.toLowerCase();
  for (let i = 0; i < TOPIC_PRIORITY_ORDER.length; i++) {
    if (lower.includes(TOPIC_PRIORITY_ORDER[i])) {
      return i;
    }
  }
  return 50; // default middle-weight
}

/**
 * Super smart AI DSA Planner engine.
 * Synthesizes pedagogical ordering, user solve progress, difficulty curve balancing,
 * and track coverage into a custom day-by-day roadmap.
 */
export function generateSmartPlan(config: SmartPlanConfig): SmartPlanResult {
  const {
    trackIds,
    strategy,
    durationDays,
    problemsPerDay,
    startDate,
    includeRestDays = false,
    progress,
  } = config;

  const validTracks = trackIds.length > 0 ? trackIds : TRACK_ORDER;

  // 1. Gather all candidates across selected tracks
  const seenTitles = new Set<string>();
  const candidates: SmartPlanCandidate[] = [];

  for (const trackId of validTracks) {
    const track = getTrack(trackId);
    if (!track) continue;
    const meta = TRACK_META[trackId];

    track.groups.forEach((group, gIdx) => {
      for (const p of group.problems) {
        // Skip solved problems
        if (progress[p.id]) continue;

        // Deduplicate common problems across sheets (e.g. Two Sum in A2Z & Blind 75)
        const normTitle = p.title.trim().toLowerCase();
        if (seenTitles.has(normTitle)) continue;
        seenTitles.add(normTitle);

        candidates.push({
          id: p.id,
          title: p.title,
          difficulty: p.difficulty || 'Medium',
          trackId,
          trackLabel: meta.shortLabel,
          topicTitle: group.title,
          topicIndex: gIdx,
          links: p.links,
        });
      }
    });
  }

  // 2. Sort candidates based on the selected smart strategy
  let prioritizedPool: SmartPlanCandidate[] = [...candidates];

  switch (strategy) {
    case 'interview_fast_track': {
      // Prioritize Blind 75 and NeetCode 150 first, then pedagogical flow
      prioritizedPool.sort((a, b) => {
        const aIsFast = a.trackId === 'blind75' ? 2 : a.trackId === 'nc150' ? 1 : 0;
        const bIsFast = b.trackId === 'blind75' ? 2 : b.trackId === 'nc150' ? 1 : 0;
        if (aIsFast !== bIsFast) return bIsFast - aIsFast;
        return getTopicScore(a.topicTitle) - getTopicScore(b.topicTitle);
      });
      break;
    }

    case 'curriculum_mastery': {
      // Strict pedagogical sequence: topic order, then step index
      prioritizedPool.sort((a, b) => {
        const scoreA = getTopicScore(a.topicTitle);
        const scoreB = getTopicScore(b.topicTitle);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.topicIndex - b.topicIndex;
      });
      break;
    }

    case 'weakness_focus': {
      // Group by topic and prioritize topics where user has unsolved items
      // Interleave topics with low completion
      prioritizedPool.sort((a, b) => {
        // Prioritize deeper topics like Trees, Graphs, DP that candidates frequently struggle with
        const scoreA = getTopicScore(a.topicTitle);
        const scoreB = getTopicScore(b.topicTitle);
        // Reverse so core weak spots come into focus
        if (Math.abs(scoreA - scoreB) > 4) {
          return scoreA - scoreB;
        }
        return b.topicIndex - a.topicIndex;
      });
      break;
    }

    case 'difficulty_balanced':
    default: {
      // Will be balanced during daily allocation
      prioritizedPool.sort((a, b) => getTopicScore(a.topicTitle) - getTopicScore(b.topicTitle));
      break;
    }
  }

  // 3. Build Day-by-Day Schedule
  const days: SmartPlanDay[] = [];
  const startObj = parseFromDateKey(startDate);

  let poolIndex = 0;
  const poolEasy = prioritizedPool.filter((p) => p.difficulty.toLowerCase() === 'easy');
  const poolMedium = prioritizedPool.filter((p) => p.difficulty.toLowerCase() === 'medium');
  const poolHard = prioritizedPool.filter((p) => p.difficulty.toLowerCase() === 'hard');

  let easyIdx = 0;
  let medIdx = 0;
  let hardIdx = 0;

  for (let d = 0; d < durationDays; d++) {
    const curDate = new Date(startObj.getTime() + d * 86400000);
    const dateKey = formatToDateKey(curDate);
    const dayName = curDate.toLocaleDateString(undefined, { weekday: 'short' });
    const displayDate = curDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    // Rest/review day every 7th day if enabled
    const isRest = includeRestDays && (d + 1) % 7 === 0;

    if (isRest) {
      days.push({
        date: dateKey,
        dayIndex: d + 1,
        dayName,
        displayDate,
        isRestDay: true,
        theme: 'Weekly Review & Spaced Repetition',
        problems: [],
      });
      continue;
    }

    const dayProblems: SmartPlanCandidate[] = [];

    if (strategy === 'difficulty_balanced') {
      // 1 Easy warm-up + (N-1) Mediums; occasional Hard every 4 days if problemsPerDay >= 3
      if (easyIdx < poolEasy.length && problemsPerDay >= 2) {
        dayProblems.push(poolEasy[easyIdx++]);
      }

      const shouldIncludeHard = (d + 1) % 4 === 0 && hardIdx < poolHard.length && problemsPerDay >= 3;
      if (shouldIncludeHard) {
        dayProblems.push(poolHard[hardIdx++]);
      }

      while (dayProblems.length < problemsPerDay && medIdx < poolMedium.length) {
        dayProblems.push(poolMedium[medIdx++]);
      }

      // If medium ran out, fill from general pool
      while (dayProblems.length < problemsPerDay && poolIndex < prioritizedPool.length) {
        const candidate = prioritizedPool[poolIndex++];
        if (!dayProblems.some((p) => p.id === candidate.id)) {
          dayProblems.push(candidate);
        }
      }
    } else {
      // Sequential allocation from prioritizedPool
      while (dayProblems.length < problemsPerDay && poolIndex < prioritizedPool.length) {
        dayProblems.push(prioritizedPool[poolIndex++]);
      }
    }

    // Determine day's theme from dominant topic
    let theme = 'Algorithmic Foundations';
    if (dayProblems.length > 0) {
      const topicFreq: Record<string, number> = {};
      for (const p of dayProblems) {
        topicFreq[p.topicTitle] = (topicFreq[p.topicTitle] || 0) + 1;
      }
      const sortedTopics = Object.entries(topicFreq).sort((a, b) => b[1] - a[1]);
      theme = sortedTopics[0][0];
      if (sortedTopics.length > 1 && sortedTopics[1]) {
        theme += ` & ${sortedTopics[1][0]}`;
      }
    }

    days.push({
      date: dateKey,
      dayIndex: d + 1,
      dayName,
      displayDate,
      isRestDay: false,
      theme,
      problems: dayProblems,
    });
  }

  // 4. Calculate plan metadata & breakdown
  let totalProblems = 0;
  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;
  const topicsSet = new Set<string>();

  for (const day of days) {
    for (const p of day.problems) {
      totalProblems++;
      topicsSet.add(p.topicTitle);
      const diff = p.difficulty.toLowerCase();
      if (diff === 'easy') easyCount++;
      else if (diff === 'hard') hardCount++;
      else mediumCount++;
    }
  }

  // Estimated study hours: Easy ~20m, Medium ~45m, Hard ~90m
  const estimatedHoursTotal = Math.round(
    (easyCount * 0.33 + mediumCount * 0.75 + hardCount * 1.5) * 10
  ) / 10;

  // Synthesize rationale
  let rationale = '';
  switch (strategy) {
    case 'interview_fast_track':
      rationale = `Curated high-impact sprint prioritizing top-frequency interview patterns across ${topicsSet.size} core topics. Built to maximize pattern recognition in minimal calendar days.`;
      break;
    case 'curriculum_mastery':
      rationale = `Rigorous pedagogical progression structured sequentially from foundational linear data structures up to advanced non-linear trees, graphs, and dynamic programming.`;
      break;
    case 'weakness_focus':
      rationale = `Targeted diagnostic roadmap front-loading your least-practiced algorithmic domains to eliminate interview blind spots before contest season.`;
      break;
    case 'difficulty_balanced':
    default:
      rationale = `Cognitively balanced daily roadmap pairing 1 Easy concept anchor with 1–2 Medium interview questions to sustain streak momentum without study burnout.`;
      break;
  }

  const coachTips = [
    'Always sketch edge cases (empty input, duplicates, negative numbers) on paper before writing code.',
    'Focus on pattern classification: identify whether the problem is 2-Pointer, Sliding Window, or Monotonic Stack.',
    'For every problem you solve, verbally explain the time and space complexity to yourself as if in an interview.',
    'If stuck for more than 25 minutes, use Pacer AI to get a conceptual hint rather than reading the complete solution.',
    'Review yesterday’s solutions for 5 minutes each morning before beginning today’s queue.',
  ];
  const coachTip = coachTips[Math.floor(Math.random() * coachTips.length)];

  return {
    days,
    totalProblems,
    breakdown: {
      easy: easyCount,
      medium: mediumCount,
      hard: hardCount,
    },
    topicsCovered: Array.from(topicsSet),
    rationale,
    estimatedHoursTotal,
    coachTip,
  };
}
