// Builds src/data/stripe-amazon.json (+ its notes in src/data/topic-notes.json) from
// data-pipeline/sources/stripe-amazon-plan.mjs, verifying every link first.
// Exits non-zero, writing nothing, if any LeetCode slug, YouTube video or URL fails to resolve.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAYS, TRACK } from './sources/stripe-amazon-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36' };
const MAX_NOTE_CHARS = 370; // TopicSection shows ~6 lines of note before clipping.

const KIND_LABEL = { video: 'Video', read: 'Read', build: 'Build', mock: 'Mock', story: 'Story', drill: 'Drill' };

// ---- Known-good links from the existing (already verified) sheets, keyed by LeetCode slug ----
const slugOf = (url) => (url && url.match(/leetcode\.com\/problems\/([^/]+)/) || [])[1] || null;
const known = new Map();
function absorb(problem, source) {
  const slug = slugOf(problem.links?.leetcode);
  if (!slug) return;
  const entry = known.get(slug) || {};
  const l = problem.links || {};
  if (source === 'neetcode') {
    entry.neetcode ??= l.neetcode || null;
    entry.article ??= l.article || null;
  } else {
    entry.youtube ??= l.youtube || null;
    entry.gfg ??= l.gfg || null;
  }
  known.set(slug, entry);
}
for (const file of ['src/data/neetcode150.json', 'src/data/neetcode250.json', 'src/data/blind75.json']) {
  for (const g of readJson(file).groups) for (const p of g.problems) absorb(p, 'neetcode');
}
for (const step of readJson('src/data/a2z.json').steps) {
  for (const sub of step.subSteps) for (const p of sub.problems) absorb(p, 'a2z');
}

// ---- Verifiers ----
const failures = [];

async function leetcode(slug) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: { ...UA, 'Content-Type': 'application/json', Referer: `https://leetcode.com/problems/${slug}/` },
        body: JSON.stringify({
          query: 'query q($s:String!){question(titleSlug:$s){questionFrontendId title difficulty isPaidOnly}}',
          variables: { s: slug },
        }),
      });
      const json = await res.json();
      return json?.data?.question || null;
    } catch {
      await sleep(1500 * attempt);
    }
  }
  return null;
}

async function youtube(id) {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
    { headers: UA }
  );
  if (res.ok) {
    const json = await res.json();
    return { title: json.title, channel: json.author_name };
  }
  // oEmbed answers 401 for videos whose owners disable embedding (e.g. Stanford lectures),
  // so confirm those from the watch page itself: it must be playable and have a real title.
  if (res.status !== 401) return null;
  const html = await (await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: { ...UA, 'Accept-Language': 'en-US' } })).text();
  const playable = /"playabilityStatus":\{"status":"OK"/.test(html);
  const title = (html.match(/<title>([^<]*?) - YouTube<\/title>/) || [])[1];
  return playable && title ? { title: title.replace(/&amp;/g, '&'), channel: '(embedding disabled; watch page OK)' } : null;
}

const urlCache = new Map();
async function urlOk(url) {
  if (urlCache.has(url)) return urlCache.get(url);
  let ok = false;
  for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      ok = res.ok;
    } catch {
      await sleep(1000);
    }
  }
  urlCache.set(url, ok);
  return ok;
}

// ---- Build ----
const usedIds = new Set();
const uniqueId = (base) => {
  let id = base;
  for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
  usedIds.add(id);
  return id;
};
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

const lcCache = new Map();
async function resolveLeetCode(slug) {
  if (!lcCache.has(slug)) {
    lcCache.set(slug, await leetcode(slug));
    await sleep(250);
  }
  return lcCache.get(slug);
}

async function problemFromSlug(slug, id, titlePrefix = '') {
  const q = await resolveLeetCode(slug);
  if (!q) {
    failures.push(`LeetCode slug not found: ${slug}`);
    return null;
  }
  const k = known.get(slug) || {};
  const links = {
    leetcode: `https://leetcode.com/problems/${slug}/`,
    neetcode: k.neetcode || null,
    article: k.article || null,
    youtube: k.youtube || null,
    gfg: k.gfg || null,
  };
  let title = `${titlePrefix}${q.title}`;
  if (q.isPaidOnly) {
    if (links.neetcode) {
      // Premium on LeetCode: send the title link to NeetCode's free version instead.
      links.practice = links.neetcode;
      links.leetcode = null;
    } else {
      title += ' (LeetCode Premium)';
    }
  }
  return { id, title, difficulty: q.difficulty, links: Object.fromEntries(Object.entries(links).filter(([, v]) => v)) };
}

const groups = [];
const notes = {};
let counts = { lc: 0, video: 0, other: 0 };

for (const day of DAYS) {
  if (day.note.length > MAX_NOTE_CHARS) {
    failures.push(`Note too long for ${day.id}: ${day.note.length} chars (max ${MAX_NOTE_CHARS})`);
  }
  notes[day.id] = day.note;
  const problems = [];

  for (const item of day.items) {
    if (item.kind === 'lc') {
      const p = await problemFromSlug(item.slug, uniqueId(`sa-${item.slug}`));
      if (p) problems.push(p), counts.lc++;
    } else if (item.kind === 'redo') {
      const p = await problemFromSlug(item.slug, uniqueId(`sa-redo-${item.slug}`), 'Redo: ');
      if (p) problems.push(p), counts.lc++;
    } else if (item.kind === 'video') {
      const meta = await youtube(item.yt);
      if (!meta) failures.push(`YouTube video unavailable: ${item.yt} (${item.title})`);
      else console.log(`  yt ${item.yt}  ${meta.channel} — ${meta.title}`);
      problems.push({
        id: uniqueId(`sa-v-${item.yt}`),
        title: item.title,
        difficulty: 'Video',
        links: { youtube: `https://www.youtube.com/watch?v=${item.yt}` },
      });
      counts.video++;
    } else if (item.kind === 'gfg') {
      if (!(await urlOk(item.url))) failures.push(`URL failed: ${item.url}`);
      problems.push({ id: uniqueId(`sa-${slugify(item.title)}`), title: item.title, difficulty: item.difficulty, links: { gfg: item.url } });
      counts.lc++;
    } else {
      if (item.url && !(await urlOk(item.url))) failures.push(`URL failed: ${item.url}`);
      problems.push({
        id: uniqueId(`sa-${item.kind}-${slugify(item.title)}`),
        title: item.title,
        difficulty: KIND_LABEL[item.kind],
        links: item.url ? { article: item.url } : {},
      });
      counts.other++;
    }
  }
  groups.push({ id: day.id, title: day.title, problems });
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s); nothing written:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}

fs.writeFileSync(
  path.join(root, 'src/data/stripe-amazon.json'),
  JSON.stringify({ trackId: TRACK.trackId, title: TRACK.title, groups }, null, 1) + '\n'
);
const topicNotes = readJson('src/data/topic-notes.json');
topicNotes.stripeAmazon = notes;
fs.writeFileSync(path.join(root, 'src/data/topic-notes.json'), JSON.stringify(topicNotes, null, 2) + '\n');

const premium = [...lcCache.entries()].filter(([, q]) => q?.isPaidOnly).map(([s]) => s);
console.log(
  `\nWrote ${groups.length} days: ${counts.lc} problems, ${counts.video} videos, ${counts.other} reading/build/mock/story/drill items.`
);
console.log(`Premium on LeetCode: ${premium.join(', ') || 'none'}`);
