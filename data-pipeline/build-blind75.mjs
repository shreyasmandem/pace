// Builds src/data/blind75.json. The 75 problems + categories were scraped
// live from neetcode.io's own Blind 75 page (data-pipeline/sources/blind75-raw.json)
// — not a slice of NeetCode 150, not hand-typed. Links are resolved by exact
// (normalized) title match against the NeetCode 250 dataset, which uses the
// identical category taxonomy and is a superset of Blind 75.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, slugify } from './lib/text.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';

function build() {
  const raw = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data-pipeline/sources/blind75-raw.json'), 'utf8')
  );
  const nc250 = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/neetcode250.json'), 'utf8'));
  const nc150 = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/neetcode150.json'), 'utf8'));

  const byTitle = new Map();
  for (const group of [...nc250.groups, ...nc150.groups]) {
    for (const p of group.problems) {
      const key = normalize(p.title);
      if (!byTitle.has(key)) byTitle.set(key, p);
    }
  }

  let total = 0;
  let resolved = 0;
  const unresolved = [];

  const groups = raw.categories.map((cat) => {
    const problems = cat.problems.map((p) => {
      total += 1;
      const match = byTitle.get(normalize(p.title));
      if (match) resolved += 1;
      else unresolved.push(p.title);
      return {
        id: `blind75-${slugify(p.title)}`,
        title: p.title,
        difficulty: p.difficulty,
        links: {
          leetcode: match?.links.leetcode || null,
          neetcode: match?.links.neetcode || null,
          article: match?.links.article || null,
        },
      };
    });
    return { id: `blind75-${slugify(cat.title)}`, title: cat.title, problems };
  });

  const out = { trackId: 'blind75', title: 'Blind 75', groups };
  fs.writeFileSync(path.join(ROOT, 'src/data/blind75.json'), JSON.stringify(out, null, 2) + '\n');

  console.log(`[blind75] ${total} problems, ${resolved} resolved to links (${total - resolved} unresolved)`);
  if (unresolved.length) console.log('[blind75] unresolved:', unresolved);
}

build();
