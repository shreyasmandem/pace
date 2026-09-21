// Builds src/data/a2z.json from the raw Striver A2Z sheet source plus the
// real "take U forward" YouTube playlist, matching each problem (and each
// topic) to its actual lecture video by text similarity. Nothing here is
// fabricated: a problem with no confident match simply gets no video.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { containmentScore, tokenSet } from './lib/text.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';

function loadSheet() {
  const file = path.join(ROOT, '_source_algo/client/src/data/striversSheet.js');
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace('export default STRIVERS_SHEET;', 'module.exports = STRIVERS_SHEET;');
  const mod = { exports: {} };
  new Function('module', 'exports', src)(mod, mod.exports);
  return mod.exports;
}

function loadPlaylist() {
  const file = path.join(ROOT, 'data-pipeline/sources/striver-a2z-youtube-playlist.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return raw.videos
    .filter((v) => v.label && v.label !== 'Play')
    .map((v) => {
      // Strip a trailing duration string like "8 minutes, 51 seconds" / "1 hour, 26 minutes".
      const clean = v.label
        .replace(/\s*(?:\d+\s*hours?,?\s*)?(?:\d+\s*minutes?,?\s*)?(?:\d+\s*seconds?)?\s*$/i, '')
        .trim();
      return { id: v.id, title: clean };
    });
}

function resolveGfgLink(gfgLink) {
  if (!gfgLink) return null;
  if (typeof gfgLink === 'string') return gfgLink;
  return gfgLink['C++'] || gfgLink.Java || gfgLink.Python || Object.values(gfgLink)[0] || null;
}

function bestVideoMatch(title, videos) {
  const qSize = tokenSet(title).size;
  if (qSize === 0) return null;
  // Very short/generic titles (<=2 meaningful words, e.g. "Data Types") need a
  // perfect match to count; longer, more specific titles allow one stray word.
  const threshold = qSize <= 2 ? 1 : qSize === 3 ? 0.85 : 0.75;

  let best = null;
  let bestScore = 0;
  for (const video of videos) {
    const score = containmentScore(title, video.title);
    if (score > bestScore) {
      bestScore = score;
      best = video;
    }
  }
  return bestScore >= threshold ? { video: best, score: bestScore } : null;
}

function mode(arr) {
  if (arr.length === 0) return null;
  const counts = new Map();
  for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function build() {
  const sheet = loadSheet();
  const videos = loadPlaylist();

  let totalProblems = 0;
  let matchedProblems = 0;

  const steps = sheet.map((step) => {
    const subSteps = step.subSteps.map((sub) => {
      const problems = sub.problems.map((p, i) => {
        totalProblems += 1;
        const match = bestVideoMatch(p.title, videos);
        if (match) matchedProblems += 1;
        return {
          id: `a2z-${step.stepNo}-${sub.subStepNo}-${i}`,
          title: p.title,
          difficulty: p.difficulty || 'Practice',
          links: {
            leetcode: p.lcLink || null,
            gfg: resolveGfgLink(p.gfgLink),
            codestudio: p.cnLink || null,
            youtube: match ? `https://www.youtube.com/watch?v=${match.video.id}` : null,
          },
        };
      });

      // Topic-level video: the video most of this topic's problems matched,
      // else try matching the topic title itself directly.
      const matchedIds = sub.problems
        .map((p) => bestVideoMatch(p.title, videos))
        .filter(Boolean)
        .map((m) => m.video.id);
      let topicVideoId = mode(matchedIds);
      if (!topicVideoId) {
        const titleMatch = bestVideoMatch(sub.subStepTitle, videos);
        topicVideoId = titleMatch ? titleMatch.video.id : null;
      }

      return {
        id: `a2z-${step.stepNo}-${sub.subStepNo}`,
        title: sub.subStepTitle,
        videoUrl: topicVideoId ? `https://www.youtube.com/watch?v=${topicVideoId}` : null,
        problems,
      };
    });

    return {
      id: `a2z-step-${step.stepNo}`,
      order: step.stepNo,
      title: step.stepTitle,
      subSteps,
    };
  });

  const out = { trackId: 'a2z', title: "Striver's A2Z DSA Sheet", steps };
  fs.mkdirSync(path.join(ROOT, 'src/data'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'src/data/a2z.json'), JSON.stringify(out, null, 2) + '\n');

  console.log(
    `[a2z] ${totalProblems} problems total, ${matchedProblems} matched to a video ` +
      `(${Math.round((matchedProblems / totalProblems) * 100)}%)`
  );
  const topicsWithVideo = steps.reduce(
    (n, s) => n + s.subSteps.filter((sub) => sub.videoUrl).length,
    0
  );
  const totalTopics = steps.reduce((n, s) => n + s.subSteps.length, 0);
  console.log(`[a2z] ${topicsWithVideo}/${totalTopics} topics have a video`);
}

build();
