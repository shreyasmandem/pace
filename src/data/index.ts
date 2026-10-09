import a2zRaw from './a2z.json';
import nc150Raw from './neetcode150.json';
import nc250Raw from './neetcode250.json';
import blind75Raw from './blind75.json';
import stripeAmazonRaw from './stripe-amazon.json';
import topicNotesRaw from './topic-notes.json';
import companiesRaw from './companies.json';
import type {
  A2ZData,
  GroupedTrackData,
  NormalizedTrack,
  TopicNotes,
  TrackId,
  TrackMeta,
  CompanyMeta,
  CompanyProblem,
  CustomTrack,
} from '../types';

export const COMPANIES: CompanyMeta[] = companiesRaw as CompanyMeta[];

const a2z = a2zRaw as A2ZData;
const nc150 = nc150Raw as GroupedTrackData;
const nc250 = nc250Raw as GroupedTrackData;
const blind75 = blind75Raw as GroupedTrackData;
const stripeAmazon = stripeAmazonRaw as GroupedTrackData;

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
  'stripe-amazon': {
    id: 'stripe-amazon',
    label: 'Stripe × Amazon Sprint',
    shortLabel: 'Stripe × Amazon',
    subtitle:
      'Oct 7 → Oct 30: DSA, Stripe practical coding, Amazon Applied Scientist ML and Leadership Principles, day by day.',
    source: 'Stripe & Amazon interview write-ups',
    sourceUrl:
      'https://medium.com/nybles/amazon-applied-scientist-intern-interview-experience-ml-challenge-2025-5092441d0b2e',
    accent: 'var(--difficulty-medium)',
  },
} as Record<TrackId, TrackMeta>;

export const ADMIN_ONLY_TRACKS: TrackId[] = ['stripe-amazon'];

export const BASE_TRACK_ORDER: TrackId[] = ['stripe-amazon', 'a2z', 'nc150', 'nc250', 'blind75'];
export const BASE_PUBLIC_TRACK_ORDER: TrackId[] = ['a2z', 'nc150', 'nc250', 'blind75'];

export const TRACK_ORDER: TrackId[] = [...BASE_TRACK_ORDER];
export const PUBLIC_TRACK_ORDER: TrackId[] = [...BASE_PUBLIC_TRACK_ORDER];

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
  'stripe-amazon': normalizeGrouped(stripeAmazon),
} as Record<TrackId, NormalizedTrack>;

const customTracksRegistry: Record<string, CustomTrack> = {};

export function syncCustomTracksRegistry(customTracks: Record<string, CustomTrack> | undefined) {
  // Remove old custom tracks from TRACK_META, NORMALIZED, and order arrays
  for (const key of Object.keys(customTracksRegistry)) {
    delete customTracksRegistry[key];
  }
  for (const key of Object.keys(TRACK_META)) {
    if (key.startsWith('oa_')) {
      delete TRACK_META[key as TrackId];
    }
  }
  for (const key of Object.keys(NORMALIZED)) {
    if (key.startsWith('oa_')) {
      delete NORMALIZED[key as TrackId];
    }
  }

  const sortedCustom = Object.values(customTracks || {}).sort((a, b) => b.createdAt - a.createdAt);

  for (const ct of sortedCustom) {
    if (!ct || !ct.id) continue;
    customTracksRegistry[ct.id] = ct;
    TRACK_META[ct.id] = {
      id: ct.id,
      label: ct.title,
      shortLabel: ct.shortLabel || ct.title.slice(0, 18),
      subtitle: ct.subtitle,
      source: `Pacer AI • ${ct.companyName} OA Ready`,
      sourceUrl: `#/company/${ct.companyId}`,
      accent: ct.accent || 'var(--accent)',
      isCustom: true,
      companyId: ct.companyId,
      companyName: ct.companyName,
    };
    NORMALIZED[ct.id] = {
      id: ct.id,
      title: ct.title,
      groups: Array.isArray(ct.groups) ? ct.groups : [],
    };
  }

  // Rebuild TRACK_ORDER and PUBLIC_TRACK_ORDER in place so imports see updated list
  const customIds = sortedCustom.map((c) => c.id);
  TRACK_ORDER.splice(0, TRACK_ORDER.length, ...BASE_TRACK_ORDER, ...customIds);
  PUBLIC_TRACK_ORDER.splice(0, PUBLIC_TRACK_ORDER.length, ...BASE_PUBLIC_TRACK_ORDER, ...customIds);
}

// Immediately hydrate custom tracks from localStorage on module load so initial render has all metadata
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem('pace-store');
    if (raw) {
      const parsed = JSON.parse(raw);
      const persistedCustom = parsed?.state?.customTracks;
      if (persistedCustom && typeof persistedCustom === 'object') {
        syncCustomTracksRegistry(persistedCustom);
      }
    }
  }
} catch {
  // ignore
}

export function getCustomTrack(id: string): CustomTrack | undefined {
  return customTracksRegistry[id];
}

export function isCustomTrack(trackId: string): boolean {
  return trackId.startsWith('oa_');
}

export function isAdminOnlyTrack(trackId: string): boolean {
  return ADMIN_ONLY_TRACKS.includes(trackId as TrackId);
}

export function getVisibleTrackOrder(isAdmin: boolean): TrackId[] {
  const customIds = Object.values(customTracksRegistry)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((c) => c.id);
  const base = isAdmin ? BASE_TRACK_ORDER : BASE_PUBLIC_TRACK_ORDER;
  return [...base, ...customIds];
}

export function filterVisibleTracks(tracks: TrackId[], isAdmin: boolean): TrackId[] {
  return tracks.filter((id) => {
    if (!isAdmin && isAdminOnlyTrack(id)) return false;
    return id in TRACK_META;
  });
}

/** The A2Z track keeps its step/subStep hierarchy for the sheet page; every other track is a flat list of groups. */
export function getA2ZSteps() {
  return a2z.steps;
}

export function getTrack(id: TrackId): NormalizedTrack {
  return NORMALIZED[id] || { id, title: 'Custom Track', groups: [] };
}

export function getAllProblems(id: TrackId) {
  return (NORMALIZED[id]?.groups || []).flatMap((g) => g.problems);
}

export function getTopicNote(trackId: TrackId, groupId: string, groupTitle: string): string | null {
  if (trackId.startsWith('oa_')) {
    return customTracksRegistry[trackId]?.sectionMeta?.[groupId]?.reasoning ?? null;
  }
  if (trackId === 'a2z') return topicNotes.a2z[groupId] ?? null;
  if (trackId === 'stripe-amazon') return topicNotes.stripeAmazon[groupId] ?? null;
  return topicNotes.neetcode[groupTitle] ?? null;
}

export const ALL_TRACKS = NORMALIZED;

const companyCache = new Map<string, CompanyProblem[]>();

export function getCompanyMeta(id: string): CompanyMeta | undefined {
  return COMPANIES.find((c) => c.id === id);
}

export function getFeaturedCompanies(): CompanyMeta[] {
  return COMPANIES.filter((c) => c.featured);
}

export async function fetchCompanyProblems(id: string): Promise<CompanyProblem[]> {
  if (companyCache.has(id)) {
    return companyCache.get(id)!;
  }
  const res = await fetch(`/data/companies/${id}.json`);
  if (!res.ok) {
    throw new Error(`Failed to load company questions for ${id}`);
  }
  const data: CompanyProblem[] = await res.json();
  companyCache.set(id, data);
  return data;
}
