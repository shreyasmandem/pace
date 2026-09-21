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
  trackId: 'nc150' | 'nc250' | 'blind75';
  title: string;
  groups: TopicGroup[];
}

export type TrackId = 'a2z' | 'nc150' | 'nc250' | 'blind75';

export interface TrackMeta {
  id: TrackId;
  label: string;
  shortLabel: string;
  subtitle: string;
  source: string;
  sourceUrl: string;
  accent: string;
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
}
