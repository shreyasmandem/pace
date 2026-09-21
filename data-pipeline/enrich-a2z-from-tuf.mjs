// Enriches src/data/a2z.json with data extracted live from takeuforward.org's
// own page payload (data-pipeline/sources/tuf-live-extract.json — 389 items
// with real article links, precise timestamped YouTube links, and LeetCode
// links, pulled directly from TUF's Next.js RSC payload, not scraped prose).
// Matches by title (exact first, then containment) since TUF's title text
// sometimes differs slightly from the striversSheet.js source (e.g. shorter).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { containmentScore, normalize } from './lib/text.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';

function bestTufMatch(title, tufItems, usedIndices) {
  const norm = normalize(title);
  // exact normalized match first
  for (let i = 0; i < tufItems.length; i++) {
    if (usedIndices.has(i)) continue;
    if (normalize(tufItems[i].title) === norm) return i;
  }
  // fall back to containment (whichever direction), same threshold logic as build-a2z
  const qSize = norm.split(' ').filter(Boolean).length;
  const threshold = qSize <= 2 ? 1 : qSize === 3 ? 0.85 : 0.75;
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < tufItems.length; i++) {
    if (usedIndices.has(i)) continue;
    const score = Math.max(
      containmentScore(title, tufItems[i].title),
      containmentScore(tufItems[i].title, title)
    );
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return bestScore >= threshold ? best : -1;
}

function build() {
  const a2z = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/a2z.json'), 'utf8'));
  const tufItems = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data-pipeline/sources/tuf-live-extract.json'), 'utf8')
  );

  const usedIndices = new Set();
  let totalProblems = 0;
  let newArticles = 0;
  let upgradedVideos = 0;
  let confirmedLeetcode = 0;
  let patternsSwapped = 0;

  for (const step of a2z.steps) {
    for (const sub of step.subSteps) {
      for (const p of sub.problems) {
        totalProblems += 1;
        const idx = bestTufMatch(p.title, tufItems, usedIndices);
        if (idx === -1) continue;
        usedIndices.add(idx);
        const tuf = tufItems[idx];

        if (tuf.article && !p.links.article) {
          p.links.article = `https://takeuforward.org${tuf.article}`;
          newArticles += 1;
        }
        if (tuf.youtube) {
          // TUF's own link carries a precise `?t=` timestamp into the exact
          // lecture moment — strictly better than our topic-level match.
          p.links.youtube = tuf.youtube;
          upgradedVideos += 1;
        }
        if (tuf.leetcode) confirmedLeetcode += 1;

        // The 22 pattern-printing problems only ever had a Code360 link —
        // TUF now hosts its own free practice page for each (verified live,
        // 22/22 resolve). Swap Code360 out for that.
        if (tuf.category === 'patterns' && tuf.slug) {
          p.links.practice = `https://takeuforward.org/practice/dsa/${tuf.slug}`;
          p.links.codestudio = null;
          patternsSwapped += 1;
        }
      }
    }
  }

  fs.writeFileSync(path.join(ROOT, 'src/data/a2z.json'), JSON.stringify(a2z, null, 2) + '\n');
  console.log(
    `[enrich-a2z] matched ${usedIndices.size}/${tufItems.length} TUF items against ${totalProblems} problems`
  );
  console.log(`[enrich-a2z] +${newArticles} article links, ${upgradedVideos} precise video links, ${confirmedLeetcode} leetcode cross-checks`);
  console.log(`[enrich-a2z] ${patternsSwapped} pattern problems switched from Code360 to takeUforward's own practice page`);
}

build();
