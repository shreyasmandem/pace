import a2zRaw from './a2z.json';
import nc150Raw from './neetcode150.json';
import nc250Raw from './neetcode250.json';
import blind75Raw from './blind75.json';
import topicNotesRaw from './topic-notes.json';
import type {
  A2ZData,
  GroupedTrackData,
  NormalizedTrack,
  TopicNotes,
  TrackId,
  TrackMeta,
} from '../types';

const a2z = a2zRaw as A2ZData;
const nc150 = nc150Raw as GroupedTrackData;
const nc250 = nc250Raw as GroupedTrackData;
const blind75 = blind75Raw as GroupedTrackData;

export const topicNotes = topicNotesRaw as TopicNotes;

export const TRACK_META: Record<TrackId, TrackMeta> = {
  a2z: {
    id: 'a2z',
    label: "Striver's A2Z DSA Sheet",
    shortLabel: 'A2Z',
    subtitle: 'Every data structure and algorithm, from the ground up.',
    source: 'take U forward',
    sourceUrl: 'https://takeuforward.org/',
    accent: 'var(--track-a2z)',
  },
  nc150: {
    id: 'nc150',
    label: 'NeetCode 150',
    shortLabel: 'NC 150',
    subtitle: 'The modern interview core, curated pattern by pattern.',
    source: 'NeetCode',
    sourceUrl: 'https://neetcode.io/',
    accent: 'var(--track-nc150)',
  },
  nc250: {
    id: 'nc250',
    label: 'NeetCode 250',
    shortLabel: 'NC 250',
    subtitle: 'NeetCode 150, deepened with 100 more problems.',
    source: 'NeetCode',
    sourceUrl: 'https://neetcode.io/',
    accent: 'var(--track-nc250)',
  },
  blind75: {
    id: 'blind75',
    label: 'Blind 75',
    shortLabel: 'Blind 75',
    subtitle: 'The original, iconic 75 — still a great gut check.',
    source: 'NeetCode',
    sourceUrl: 'https://neetcode.io/practice/practice/blind75',
    accent: 'var(--track-blind75)',
  },
};

export const TRACK_ORDER: TrackId[] = ['a2z', 'nc150', 'nc250', 'blind75'];

function normalizeA2Z(): NormalizedTrack {
  return {
    id: 'a2z',
    title: a2z.title,
    groups: a2z.steps.flatMap((step) =>
      step.subSteps.map((sub) => ({
        ...sub,
        title: `${step.title} · ${sub.title}`,
      }))
    ),
  };
}

function normalizeGrouped(data: GroupedTrackData): NormalizedTrack {
  return { id: data.trackId, title: data.title, groups: data.groups };
}

const NORMALIZED: Record<TrackId, NormalizedTrack> = {
  a2z: normalizeA2Z(),
  nc150: normalizeGrouped(nc150),
  nc250: normalizeGrouped(nc250),
  blind75: normalizeGrouped(blind75),
};

/** The A2Z track keeps its step/subStep hierarchy for the sheet page; every other track is a flat list of groups. */
export function getA2ZSteps() {
  return a2z.steps;
}

export function getTrack(id: TrackId): NormalizedTrack {
  return NORMALIZED[id];
}

export function getAllProblems(id: TrackId) {
  return NORMALIZED[id].groups.flatMap((g) => g.problems);
}

export function getTopicNote(trackId: TrackId, groupId: string, groupTitle: string): string | null {
  if (trackId === 'a2z') return topicNotes.a2z[groupId] ?? null;
  return topicNotes.neetcode[groupTitle] ?? null;
}

export const ALL_TRACKS = NORMALIZED;
