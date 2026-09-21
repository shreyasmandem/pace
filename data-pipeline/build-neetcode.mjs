// Builds src/data/neetcode150.json and src/data/neetcode250.json from the
// raw source JSON. Both already carry a NeetCode video link per problem
// (the `nurl` / `neetcode_url` page embeds NeetCode's own solution video),
// so no scraping or matching is needed here — just normalization.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from './lib/text.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';

function absoluteNeetcodeUrl(u) {
  if (!u) return null;
  return u.startsWith('http') ? u : `https://neetcode.io${u}`;
}

// neetcode.io/solutions/<slug> uses the LeetCode slug directly and is free to
// read (no login) — verified live against all 250 problems before wiring this
// up (see data-pipeline/verify-neetcode-solutions.mjs).
function solutionUrl(leetcodeUrl) {
  const m = leetcodeUrl && leetcodeUrl.match(/leetcode\.com\/problems\/([^/]+)/);
  return m ? `https://neetcode.io/solutions/${m[1]}` : null;
}

function build150() {
  const file = path.join(ROOT, '_source_neetcode/neetcode-150-list.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));

  let total = 0;
  const groups = Object.entries(raw).map(([topic, entries]) => {
    const problems = Object.entries(entries).map(([title, p]) => {
      total += 1;
      return {
        id: `nc150-${slugify(title)}`,
        title,
        difficulty: p.difficulty,
        links: {
          leetcode: p.url || null,
          neetcode: absoluteNeetcodeUrl(p.nurl),
          article: solutionUrl(p.url),
        },
      };
    });
    return { id: `nc150-${slugify(topic)}`, title: topic, problems };
  });

  const out = { trackId: 'nc150', title: 'NeetCode 150', groups };
  fs.writeFileSync(path.join(ROOT, 'src/data/neetcode150.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`[neetcode150] ${total} problems across ${groups.length} groups`);
  return out;
}

function build250() {
  const file = path.join(ROOT, '_source_nc250/neetcode_250_complete.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));

  const byCategory = new Map();
  for (const p of raw.problems) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category).push({
      id: `nc250-${p.slug}`,
      title: p.name,
      difficulty: p.difficulty,
      links: {
        leetcode: p.leetcode_url || null,
        neetcode: absoluteNeetcodeUrl(p.neetcode_url),
        article: solutionUrl(p.leetcode_url),
      },
    });
  }

  const groups = [...byCategory.entries()].map(([topic, problems]) => ({
    id: `nc250-${slugify(topic)}`,
    title: topic,
    problems,
  }));

  const out = { trackId: 'nc250', title: 'NeetCode 250', groups };
  fs.writeFileSync(path.join(ROOT, 'src/data/neetcode250.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`[neetcode250] ${raw.problems.length} problems across ${groups.length} groups`);
  return out;
}

fs.mkdirSync(path.join(ROOT, 'src/data'), { recursive: true });
build150();
build250();
