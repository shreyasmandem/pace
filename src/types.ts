export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Practice';

export interface ProblemLinks {
  leetcode?: string | null;
  gfg?: string | null;
  codestudio?: string | null;
  youtube?: string | null;
  neetcode?: string | null;
  article?: string | null;
  practice?: string | null;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: string;
  links: ProblemLinks;
}

export interface TopicGroup {
  id: string;
  title: string;
  videoUrl?: string | null;
  problems: Problem[];
}

export interface A2ZStep {
  id: string;
  order: number;
  title: string;
  subSteps: TopicGroup[];
}

export interface A2ZData {
  trackId: 'a2z';
  title: string;
  steps: A2ZStep[];
}

export interface GroupedTrackData {
  trackId: 'nc150' | 'nc250' | 'blind75' | 'stripe-amazon';
  title: string;
  groups: TopicGroup[];
}

export type BuiltInTrackId = 'a2z' | 'nc150' | 'nc250' | 'blind75' | 'stripe-amazon';
export type TrackId = BuiltInTrackId | `oa_${string}`;

export type OAFocusMode = 'high_frequency' | 'balanced' | 'weakness_focus' | 'crash_course';

export interface CustomTrackSectionMeta {
  groupId: string;
  reasoning: string;
  estimatedMinutes: number;
  priorityLevel: 'critical' | 'high' | 'core' | 'stretch';
}

export interface CustomTrack {
  id: TrackId;
  title: string;
  shortLabel: string;
  subtitle: string;
  companyId: string;
  companyName: string;
  days: number;
  hoursPerDay: number;
  totalHoursBudget: number;
  focusMode: OAFocusMode;
  customPrompt?: string;
  overallReasoning: string;
  keyPatterns: string[];
  groups: TopicGroup[];
  sectionMeta: Record<string, CustomTrackSectionMeta>;
  createdAt: number;
  accent: string;
}

export interface TrackMeta {
  id: TrackId;
  label: string;
  shortLabel: string;
  subtitle: string;
  source: string;
  sourceUrl: string;
  accent: string;
  isCustom?: boolean;
  companyId?: string;
  companyName?: string;
}

/** A track normalized to a flat list of topic groups, regardless of source shape. */
export interface NormalizedTrack {
  id: TrackId;
  title: string;
  groups: TopicGroup[];
}

export interface TopicNotes {
  a2z: Record<string, string>;
  neetcode: Record<string, string>;
  stripeAmazon: Record<string, string>;
}

export interface CompanyMeta {
  id: string;
  name: string;
  total: number;
  easy: number;
  medium: number;
  hard: number;
  interviewTip?: string | null;
  featured?: boolean;
}

export interface CompanyProblem {
  id: string;
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  acceptance?: string | null;
  frequency: number;
  topics: string[];
  timeframe?: string;
  links: ProblemLinks;
}
