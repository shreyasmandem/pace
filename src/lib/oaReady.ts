import {
  BASE_PUBLIC_TRACK_ORDER,
  fetchCompanyProblems,
  getCompanyMeta,
  getTrack,
  TRACK_META,
} from '../data';
import type {
  BuiltInTrackId,
  CompanyProblem,
  CustomTrack,
  CustomTrackSectionMeta,
  OAFocusMode,
  Problem,
  ProblemLinks,
  TopicGroup,
  TrackId,
} from '../types';
import { CANDIDATE_MODELS, getGroqApiKey } from './groq';

export interface OAReadyInput {
  companyId: string;
  trackTitle?: string;
  days: number;
  hoursPerDay: number;
  focusMode: OAFocusMode;
  customPrompt?: string;
  progress: Record<string, boolean>;
}

export interface OAScrapeTelemetry {
  companyProblemsScanned: number;
  canonicalProblemsScanned: number;
  crossTrackMatches: number;
  dominantTopics: string[];
  totalMinutesBudget: number;
  selectedProblemsCount: number;
}

export interface OAReadyBuildResult {
  track: CustomTrack;
  telemetry: OAScrapeTelemetry;
}

interface CanonicalEntry {
  id: string;
  title: string;
  normTitle: string;
  slug: string;
  difficulty: string;
  links: ProblemLinks;
  tracks: BuiltInTrackId[];
  topicTitles: string[];
}

interface ScoredCandidate {
  id: string;
  title: string;
  normTitle: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  links: ProblemLinks;
  frequency: number;
  topics: string[];
  canonicalTracks: BuiltInTrackId[];
  clusterKey: string;
  clusterTitle: string;
  clusterOrder: number;
  score: number;
  estimatedMinutes: number;
  isFromCompany: boolean;
  alreadySolved: boolean;
}

interface ClusterDefinition {
  key: string;
  title: string;
  order: number;
  keywords: string[];
  priorityLevel: 'critical' | 'high' | 'core' | 'stretch';
  defaultReasoning: (companyName: string, count: number, mins: number) => string;
}

const OA_CLUSTERS: ClusterDefinition[] = [
  {
    key: 'arrays_hashing_strings',
    title: 'Phase 1 · Arrays, Hashing & String Invariants',
    order: 1,
    keywords: ['array', 'hash', 'string', 'prefix sum', 'counting', 'matrix', 'simulation', 'sorting'],
    priorityLevel: 'critical',
    defaultReasoning: (company, count, mins) =>
      `Nearly every ${company} Online Assessment opens with an Array, String, or Hash Map speed question. Clearing these ${count} problems (~${mins}m) builds O(n) lookup reflexes so you bank your first 100% test-case score in under 15 minutes.`,
  },
  {
    key: 'sliding_window_two_pointers',
    title: 'Phase 2 · Two Pointers & Sliding Window Optimization',
    order: 2,
    keywords: ['sliding window', 'two pointer', 'subarray', 'substring'],
    priorityLevel: 'critical',
    defaultReasoning: (company, count, mins) =>
      `${company} OAs frequently test contiguous subarray/substring constraints where brute force TLEs on hidden large test cases. Mastering these ${count} window invariants (~${mins}m) prevents off-by-one bugs under timer pressure.`,
  },
  {
    key: 'binary_search_stack_greedy',
    title: 'Phase 3 · Binary Search, Monotonic Stack & Greedy',
    order: 3,
    keywords: [
      'binary search',
      'stack',
      'monotonic',
      'queue',
      'greedy',
      'interval',
      'heap',
      'priority queue',
      'quickselect',
      'linked list',
      'design',
    ],
    priorityLevel: 'high',
    defaultReasoning: (company, count, mins) =>
      `"Binary Search on Answer", interval scheduling, and Heap/Monotonic Stack reductions make up the core medium-to-hard filter in ${company} assessments. These ${count} problems (~${mins}m) train you to spot O(n log n) transitions immediately.`,
  },
  {
    key: 'trees_graphs_traversal',
    title: 'Phase 4 · Trees, Graphs & Shortest-Path Traversal',
    order: 4,
    keywords: [
      'tree',
      'binary tree',
      'bst',
      'graph',
      'breadth-first',
      'depth-first',
      'bfs',
      'dfs',
      'topological',
      'union-find',
      'trie',
      'shortest path',
    ],
    priorityLevel: 'core',
    defaultReasoning: (company, count, mins) =>
      `Multi-source BFS, cycle detection, and tree recursion frequently appear as Question 2 or 3 in ${company} coding rounds. Practicing these ${count} patterns (~${mins}m) ensures clean traversal templates without recursion stack errors.`,
  },
  {
    key: 'dp_backtracking_hard',
    title: 'Phase 5 · Dynamic Programming & OA Differentiators',
    order: 5,
    keywords: [
      'dynamic programming',
      'dp',
      'memoization',
      'knapsack',
      'backtracking',
      'recursion',
      'bit manipulation',
      'math',
      'game theory',
      'divide and conquer',
    ],
    priorityLevel: 'stretch',
    defaultReasoning: (company, count, mins) =>
      `State-transition Dynamic Programming and combinatorial Backtracking separate top-decile ${company} OA submissions from partial-credit attempts. These ${count} high-leverage problems (~${mins}m) lock in 1D/2D memoization templates.`,
  },
];

const EXCLUDED_NON_DSA_TOPICS = new Set([
  'database',
  'shell',
  'concurrency',
  'javascript',
  'pandas',
]);

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractSlugFromUrl(url?: string | null): string {
  if (!url) return '';
  const match = url.match(/leetcode\.com\/problems\/([^/?#]+)/i);
  return match ? match[1].toLowerCase().trim() : '';
}

function estimateProblemMinutes(difficulty: string): number {
  const d = difficulty.toLowerCase();
  if (d === 'easy') return 20;
  if (d === 'hard') return 50;
  return 35; // Medium
}

function classifyCluster(topics: string[], fallbackTopicTitle = ''): ClusterDefinition {
  const combined = [...topics, fallbackTopicTitle].map((t) => t.toLowerCase()).join(' | ');

  // Check specific clusters in priority order:
  // Sliding window & two pointers before generic array/string so window problems land in Phase 2
  const checkOrder = [
    OA_CLUSTERS[1], // sliding_window_two_pointers
    OA_CLUSTERS[3], // trees_graphs_traversal
    OA_CLUSTERS[4], // dp_backtracking_hard
    OA_CLUSTERS[2], // binary_search_stack_greedy
    OA_CLUSTERS[0], // arrays_hashing_strings
  ];

  for (const cluster of checkOrder) {
    if (cluster.keywords.some((kw) => combined.includes(kw))) {
      return cluster;
    }
  }

  return OA_CLUSTERS[0];
}

function buildCanonicalIndex(): {
  byNormTitle: Map<string, CanonicalEntry>;
  bySlug: Map<string, CanonicalEntry>;
  allEntries: CanonicalEntry[];
  totalScanned: number;
} {
  const byNormTitle = new Map<string, CanonicalEntry>();
  const bySlug = new Map<string, CanonicalEntry>();
  const allEntries: CanonicalEntry[] = [];
  let totalScanned = 0;

  const tracksToScan: BuiltInTrackId[] = ['blind75', 'nc150', 'nc250', 'a2z'];

  for (const trackId of tracksToScan) {
    const track = getTrack(trackId);
    if (!track) continue;

    for (const group of track.groups) {
      for (const p of group.problems) {
        totalScanned++;
        const normTitle = normalizeTitle(p.title);
        const slug = extractSlugFromUrl(p.links?.leetcode) || normTitle.replace(/\s+/g, '-');
        const existing = byNormTitle.get(normTitle) || (slug ? bySlug.get(slug) : undefined);

        if (existing) {
          if (!existing.tracks.includes(trackId)) {
            existing.tracks.push(trackId);
          }
          if (!existing.topicTitles.includes(group.title)) {
            existing.topicTitles.push(group.title);
          }
          existing.links = {
            leetcode: existing.links.leetcode || p.links.leetcode,
            neetcode: existing.links.neetcode || p.links.neetcode,
            youtube: existing.links.youtube || p.links.youtube,
            article: existing.links.article || p.links.article,
            gfg: existing.links.gfg || p.links.gfg,
            codestudio: existing.links.codestudio || p.links.codestudio,
            practice: existing.links.practice || p.links.practice,
          };
        } else {
          const entry: CanonicalEntry = {
            id: p.id,
            title: p.title,
            normTitle,
            slug,
            difficulty: p.difficulty === 'Practice' ? 'Medium' : p.difficulty || 'Medium',
            links: { ...p.links },
            tracks: [trackId],
            topicTitles: [group.title],
          };
          byNormTitle.set(normTitle, entry);
          if (slug) bySlug.set(slug, entry);
          allEntries.push(entry);
        }
      }
    }
  }

  return { byNormTitle, bySlug, allEntries, totalScanned };
}

function isPureNonDSA(topics: string[]): boolean {
  if (!topics || topics.length === 0) return false;
  return topics.every((t) => EXCLUDED_NON_DSA_TOPICS.has(t.toLowerCase().trim()));
}

/**
 * Optional AI enhancement using Groq to tailor the overall reasoning and section notes.
 * Falls back cleanly and immediately if offline or rate-limited.
 */
async function enhanceWithPacerAI(
  companyName: string,
  companyTip: string | null | undefined,
  days: number,
  hoursPerDay: number,
  focusMode: OAFocusMode,
  customPrompt: string | undefined,
  groups: TopicGroup[],
  defaultOverallReasoning: string,
  defaultSectionMeta: Record<string, CustomTrackSectionMeta>
): Promise<{
  overallReasoning: string;
  sectionMeta: Record<string, CustomTrackSectionMeta>;
}> {
  const sectionSummaries = groups.map((g) => ({
    id: g.id,
    title: g.title,
    problemTitles: g.problems.slice(0, 6).map((p) => `${p.title} (${p.difficulty})`),
    totalInGroup: g.problems.length,
  }));

  const systemPrompt = `You are Pacer AI, an elite algorithmic interview strategist.
Return ONLY valid JSON (no markdown fences, no extra prose) matching this exact schema:
{
  "overallReasoning": "2-3 crisp, authoritative sentences explaining why this custom OA track is optimal for the candidate's company, time budget, and focus strategy.",
  "sections": {
    "<groupId>": "1-2 sharp sentences explaining why this specific section & problem set is critical for this company's OA and what edge-case or time-complexity invariant to watch out for."
  }
}`;

  const userMessage = JSON.stringify({
    company: companyName,
    companyInterviewPattern: companyTip || 'High-frequency algorithmic problem solving under timed OA constraints',
    prepDays: days,
    hoursPerDay,
    totalHours: Math.round(days * hoursPerDay * 10) / 10,
    strategy: focusMode,
    candidateNotes: customPrompt || 'None',
    sections: sectionSummaries,
  });

  for (const model of CANDIDATE_MODELS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5500);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getGroqApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.4,
          max_completion_tokens: 900,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok) continue;

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (typeof rawContent !== 'string' || !rawContent.trim()) continue;

      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const parsed = JSON.parse(jsonMatch[0]);
      const nextOverall =
        typeof parsed.overallReasoning === 'string' && parsed.overallReasoning.trim().length > 30
          ? parsed.overallReasoning.trim()
          : defaultOverallReasoning;

      const nextSectionMeta = { ...defaultSectionMeta };
      if (parsed.sections && typeof parsed.sections === 'object') {
        for (const [gid, text] of Object.entries(parsed.sections)) {
          if (nextSectionMeta[gid] && typeof text === 'string' && text.trim().length > 20) {
            nextSectionMeta[gid] = {
              ...nextSectionMeta[gid],
              reasoning: text.trim(),
            };
          }
        }
      }

      return {
        overallReasoning: nextOverall,
        sectionMeta: nextSectionMeta,
      };
    } catch {
      // Fall through to next model or deterministic reasoning
    }
  }

  return {
    overallReasoning: defaultOverallReasoning,
    sectionMeta: defaultSectionMeta,
  };
}

export async function buildOAReadyTrack(
  input: OAReadyInput,
  useAIRefinement = true
): Promise<OAReadyBuildResult> {
  const {
    companyId,
    trackTitle,
    days,
    hoursPerDay,
    focusMode,
    customPrompt,
    progress,
  } = input;

  const companyMeta = getCompanyMeta(companyId) || {
    id: companyId,
    name: companyId.charAt(0).toUpperCase() + companyId.slice(1),
    total: 0,
    easy: 0,
    medium: 0,
    hard: 0,
  };

  // 1. Fetch company problems and build canonical index across all tracks
  let companyProblems: CompanyProblem[] = [];
  try {
    companyProblems = await fetchCompanyProblems(companyId);
  } catch {
    companyProblems = [];
  }

  const canonical = buildCanonicalIndex();
  const promptKeywords = (customPrompt || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);

  // 2. Score and cross-reference all company problems
  const candidatesMap = new Map<string, ScoredCandidate>();
  let crossTrackMatches = 0;
  const topicFrequencyCounter: Record<string, number> = {};

  for (const cp of companyProblems) {
    if (isPureNonDSA(cp.topics)) continue;

    const normTitle = normalizeTitle(cp.title);
    const slug = (cp.slug || extractSlugFromUrl(cp.links?.leetcode) || normTitle.replace(/\s+/g, '-')).toLowerCase();
    const match = canonical.byNormTitle.get(normTitle) || canonical.bySlug.get(slug);

    if (match) {
      crossTrackMatches++;
    }

    for (const t of cp.topics || []) {
      const cleanT = t.trim();
      if (cleanT && !EXCLUDED_NON_DSA_TOPICS.has(cleanT.toLowerCase())) {
        topicFrequencyCounter[cleanT] = (topicFrequencyCounter[cleanT] || 0) + 1;
      }
    }

    const mergedLinks: ProblemLinks = {
      leetcode: cp.links?.leetcode || match?.links.leetcode,
      neetcode: match?.links.neetcode || cp.links?.neetcode,
      youtube: match?.links.youtube || cp.links?.youtube,
      article: match?.links.article || cp.links?.article,
      gfg: match?.links.gfg || cp.links?.gfg,
      codestudio: match?.links.codestudio || cp.links?.codestudio,
      practice: match?.links.practice || cp.links?.practice,
    };

    const canonicalTracks = match ? match.tracks : [];
    const cluster = classifyCluster(cp.topics || [], match?.topicTitles.join(' ') || '');
    const alreadySolved = Boolean(progress[cp.id] || (match && progress[match.id]));

    // Compute smart OA priority score
    let score = Number(cp.frequency) || 50;

    // Recency boost
    if (cp.timeframe === '30 Days') score += 22;
    else if (cp.timeframe === '3 Months') score += 14;
    else if (cp.timeframe === '6 Months') score += 8;

    // Cross-track canonical validation boost
    if (canonicalTracks.includes('blind75')) score += 26;
    if (canonicalTracks.includes('nc150')) score += 20;
    if (canonicalTracks.includes('nc250')) score += 10;
    if (canonicalTracks.includes('a2z')) score += 10;

    // Strategy-specific weighting
    if (focusMode === 'crash_course') {
      if (cp.difficulty === 'Medium') score += 18;
      if (cp.difficulty === 'Easy') score += 12;
      if (canonicalTracks.includes('blind75')) score += 15;
    } else if (focusMode === 'high_frequency') {
      score += (Number(cp.frequency) || 50) * 0.35;
      if (cp.difficulty === 'Medium') score += 12;
    } else if (focusMode === 'weakness_focus') {
      if (cluster.key === 'trees_graphs_traversal' || cluster.key === 'dp_backtracking_hard') {
        score += 28;
      } else if (cluster.key === 'binary_search_stack_greedy') {
        score += 18;
      }
      if (cp.difficulty === 'Medium' || cp.difficulty === 'Hard') score += 14;
    } else {
      // balanced
      if (cp.difficulty === 'Medium') score += 15;
    }

    // Custom prompt keyword matching
    if (promptKeywords.length > 0) {
      const searchable = `${cp.title} ${(cp.topics || []).join(' ')} ${cluster.title} ${cp.difficulty}`.toLowerCase();
      for (const kw of promptKeywords) {
        if (searchable.includes(kw)) {
          score += 25;
        }
      }
    }

    // Prioritize unsolved problems so prep time goes to new mastery
    if (alreadySolved) {
      score -= 60;
    }

    const difficulty: 'Easy' | 'Medium' | 'Hard' =
      cp.difficulty === 'Easy' || cp.difficulty === 'Medium' || cp.difficulty === 'Hard'
        ? cp.difficulty
        : 'Medium';

    candidatesMap.set(normTitle, {
      id: cp.id,
      title: cp.title,
      normTitle,
      difficulty,
      links: mergedLinks,
      frequency: Math.round(Number(cp.frequency) || 50),
      topics: cp.topics?.length ? cp.topics : match?.topicTitles || ['Algorithms'],
      canonicalTracks,
      clusterKey: cluster.key,
      clusterTitle: cluster.title,
      clusterOrder: cluster.order,
      score,
      estimatedMinutes: estimateProblemMinutes(difficulty),
      isFromCompany: true,
      alreadySolved,
    });
  }

  // 3. Calculate time budget and target problem capacity
  const safeDays = Math.max(1, Math.min(60, Math.round(days || 5)));
  const safeHoursPerDay = Math.max(0.5, Math.min(12, Number(hoursPerDay) || 2));
  const totalHoursBudget = Math.round(safeDays * safeHoursPerDay * 10) / 10;
  const totalMinutesBudget = Math.round(totalHoursBudget * 60);

  // Average OA problem takes ~32 mins (reading, coding, edge-case testing, reviewing)
  const minProblems = focusMode === 'crash_course' ? 6 : 8;
  const maxProblems = Math.min(120, Math.max(minProblems, Math.round(totalMinutesBudget / 30)));

  // 4. If company has fewer problems than budget or needs canonical pattern anchors, augment from canonical tracks
  const dominantTopics = Object.entries(topicFrequencyCounter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  if (candidatesMap.size < maxProblems * 1.5) {
    for (const entry of canonical.allEntries) {
      if (candidatesMap.has(entry.normTitle)) continue;

      const cluster = classifyCluster(entry.topicTitles);
      const alreadySolved = Boolean(progress[entry.id]);
      const diff: 'Easy' | 'Medium' | 'Hard' =
        entry.difficulty === 'Easy' || entry.difficulty === 'Hard' ? entry.difficulty : 'Medium';

      let score = 45;
      if (entry.tracks.includes('blind75')) score += 30;
      if (entry.tracks.includes('nc150')) score += 22;
      if (entry.tracks.includes('nc250')) score += 12;
      if (entry.tracks.includes('a2z')) score += 10;

      if (dominantTopics.some((dt) => entry.topicTitles.some((tt) => tt.toLowerCase().includes(dt.toLowerCase())))) {
        score += 18;
      }

      if (promptKeywords.length > 0) {
        const searchable = `${entry.title} ${entry.topicTitles.join(' ')} ${cluster.title} ${diff}`.toLowerCase();
        for (const kw of promptKeywords) {
          if (searchable.includes(kw)) score += 25;
        }
      }

      if (alreadySolved) score -= 60;

      candidatesMap.set(entry.normTitle, {
        id: entry.id,
        title: entry.title,
        normTitle: entry.normTitle,
        difficulty: diff,
        links: entry.links,
        frequency: entry.tracks.includes('blind75') ? 85 : 70,
        topics: entry.topicTitles,
        canonicalTracks: entry.tracks,
        clusterKey: cluster.key,
        clusterTitle: cluster.title,
        clusterOrder: cluster.order,
        score,
        estimatedMinutes: estimateProblemMinutes(diff),
        isFromCompany: false,
        alreadySolved,
      });
    }
  }

  // 5. Select optimal problem set within the user's time budget and desired difficulty distribution
  const allScored = Array.from(candidatesMap.values()).sort((a, b) => b.score - a.score);

  // Target difficulty ratios based on focusMode
  const ratios =
    focusMode === 'crash_course'
      ? { easy: 0.25, medium: 0.65, hard: 0.1 }
      : focusMode === 'weakness_focus'
      ? { easy: 0.1, medium: 0.6, hard: 0.3 }
      : focusMode === 'high_frequency'
      ? { easy: 0.22, medium: 0.6, hard: 0.18 }
      : { easy: 0.25, medium: 0.55, hard: 0.2 }; // balanced

  const targetEasy = Math.max(1, Math.round(maxProblems * ratios.easy));
  const targetHard = Math.max(focusMode === 'crash_course' ? 0 : 1, Math.round(maxProblems * ratios.hard));
  const targetMedium = Math.max(2, maxProblems - targetEasy - targetHard);

  const easyPool = allScored.filter((c) => c.difficulty === 'Easy');
  const mediumPool = allScored.filter((c) => c.difficulty === 'Medium');
  const hardPool = allScored.filter((c) => c.difficulty === 'Hard');

  const selected: ScoredCandidate[] = [];
  const selectedIds = new Set<string>();

  const pickFromPool = (pool: ScoredCandidate[], count: number) => {
    // Ensure diversity across clusters when picking
    const byCluster = new Map<string, ScoredCandidate[]>();
    for (const item of pool) {
      const list = byCluster.get(item.clusterKey) || [];
      list.push(item);
      byCluster.set(item.clusterKey, list);
    }

    let picked = 0;
    let round = 0;
    const clusterKeys = Array.from(byCluster.keys());
    while (picked < count && clusterKeys.length > 0) {
      let addedInRound = false;
      for (const ck of clusterKeys) {
        if (picked >= count) break;
        const list = byCluster.get(ck)!;
        if (round < list.length) {
          const candidate = list[round];
          if (!selectedIds.has(candidate.id)) {
            selected.push(candidate);
            selectedIds.add(candidate.id);
            picked++;
            addedInRound = true;
          }
        }
      }
      if (!addedInRound) break;
      round++;
    }
  };

  pickFromPool(easyPool, targetEasy);
  pickFromPool(mediumPool, targetMedium);
  pickFromPool(hardPool, targetHard);

  // Fill any remaining slots up to maxProblems from highest scored overall
  for (const item of allScored) {
    if (selected.length >= maxProblems) break;
    if (!selectedIds.has(item.id)) {
      selected.push(item);
      selectedIds.add(item.id);
    }
  }

  // 6. Group selected problems into ordered OA sections
  const groups: TopicGroup[] = [];
  const sectionMeta: Record<string, CustomTrackSectionMeta> = {};

  for (const cluster of OA_CLUSTERS) {
    const clusterProblems = selected
      .filter((c) => c.clusterKey === cluster.key)
      .sort((a, b) => {
        // Order Easy -> Medium -> Hard within each section, then by score
        const diffRank = (d: string) => (d === 'Easy' ? 0 : d === 'Medium' ? 1 : 2);
        if (diffRank(a.difficulty) !== diffRank(b.difficulty)) {
          return diffRank(a.difficulty) - diffRank(b.difficulty);
        }
        return b.score - a.score;
      });

    if (clusterProblems.length === 0) continue;

    const groupId = `oa_sec_${companyId}_${cluster.key}`;
    const estMins = clusterProblems.reduce((acc, c) => acc + c.estimatedMinutes, 0);

    const problems: Problem[] = clusterProblems.map((c) => ({
      id: c.id,
      title: c.title,
      difficulty: c.difficulty,
      links: c.links,
    }));

    groups.push({
      id: groupId,
      title: cluster.title,
      problems,
    });

    sectionMeta[groupId] = {
      groupId,
      reasoning: cluster.defaultReasoning(companyMeta.name, clusterProblems.length, estMins),
      estimatedMinutes: estMins,
      priorityLevel: cluster.priorityLevel,
    };
  }

  // 7. Synthesize overall reasoning
  const finalDominantTopics =
    dominantTopics.length > 0
      ? dominantTopics.slice(0, 4)
      : ['Arrays & Hashing', 'Sliding Window', 'Trees & Graphs', 'Dynamic Programming'];

  const companyDirectCount = selected.filter((s) => s.isFromCompany).length;
  const canonicalOverlapCount = selected.filter((s) => s.canonicalTracks.length > 0).length;

  const strategyLabel =
    focusMode === 'crash_course'
      ? 'Rapid Crash-Course Blitz'
      : focusMode === 'high_frequency'
      ? 'High-Frequency OA Sprint'
      : focusMode === 'weakness_focus'
      ? 'Hard & Differentiator Focus'
      : 'Balanced Pattern Mastery';

  let defaultOverallReasoning = `Pacer AI scraped ${
    companyProblems.length > 0 ? `${companyProblems.length} verified ${companyMeta.name} assessment questions` : `all ${companyMeta.name} pattern archetypes`
  } and cross-referenced ${canonical.totalScanned} problems across Striver's A2Z, NeetCode 150/250, and Blind 75. For your ${safeDays}-day (${safeHoursPerDay}h/day, ${totalHoursBudget}h total) window, Pacer selected ${selected.length} highest-ROI problems (${companyDirectCount} direct ${companyMeta.name} OA hits, ${canonicalOverlapCount} multi-track pattern anchors) focused on ${finalDominantTopics.join(', ')}.`;

  if (companyMeta.interviewTip) {
    defaultOverallReasoning += ` Specifically calibrated for ${companyMeta.name}'s known pattern focus: ${companyMeta.interviewTip}`;
  }

  let finalOverallReasoning = defaultOverallReasoning;
  let finalSectionMeta = sectionMeta;

  if (useAIRefinement) {
    const enhanced = await enhanceWithPacerAI(
      companyMeta.name,
      companyMeta.interviewTip,
      safeDays,
      safeHoursPerDay,
      focusMode,
      customPrompt,
      groups,
      defaultOverallReasoning,
      sectionMeta
    );
    finalOverallReasoning = enhanced.overallReasoning;
    finalSectionMeta = enhanced.sectionMeta;
  }

  const finalTitle =
    trackTitle && trackTitle.trim()
      ? trackTitle.trim()
      : `${companyMeta.name} OA Ready (${safeDays}d)`;

  const shortLabel =
    finalTitle.length > 18 ? `${companyMeta.name.slice(0, 12)} OA` : finalTitle;

  const trackId: TrackId = `oa_${companyId}_${Date.now().toString(36)}`;

  const customTrack: CustomTrack = {
    id: trackId,
    title: finalTitle,
    shortLabel,
    subtitle: `${strategyLabel} • ${safeDays} day${safeDays === 1 ? '' : 's'} (${safeHoursPerDay}h/day) • ${selected.length} curated OA problems`,
    companyId,
    companyName: companyMeta.name,
    days: safeDays,
    hoursPerDay: safeHoursPerDay,
    totalHoursBudget,
    focusMode,
    customPrompt: customPrompt?.trim() || undefined,
    overallReasoning: finalOverallReasoning,
    keyPatterns: finalDominantTopics,
    groups,
    sectionMeta: finalSectionMeta,
    createdAt: Date.now(),
    accent: 'var(--accent)',
  };

  // Ensure TRACK_META and getTrack are immediately aware if previewed
  void BASE_PUBLIC_TRACK_ORDER;
  void TRACK_META;

  return {
    track: customTrack,
    telemetry: {
      companyProblemsScanned: companyProblems.length,
      canonicalProblemsScanned: canonical.totalScanned,
      crossTrackMatches,
      dominantTopics: finalDominantTopics,
      totalMinutesBudget,
      selectedProblemsCount: selected.length,
    },
  };
}
