// One-off verification script (not part of the build pipeline): checks that
// https://neetcode.io/solutions/<leetcode-slug> actually resolves for every
// problem across nc150/nc250/blind75, since we derive that URL from the
// LeetCode slug rather than from a field NeetCode gives us directly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';

function leetcodeSlug(url) {
  if (!url) return null;
  const m = url.match(/leetcode\.com\/problems\/([^/]+)/);
  return m ? m[1] : null;
}

function loadSlugs() {
  const files = ['neetcode150.json', 'neetcode250.json', 'blind75.json'];
  const slugs = new Set();
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', f), 'utf8'));
    for (const g of data.groups) {
      for (const p of g.problems) {
        const s = leetcodeSlug(p.links.leetcode);
        if (s) slugs.add(s);
      }
    }
  }
  return [...slugs];
}

async function checkSlug(slug) {
  const url = `https://neetcode.io/solutions/${slug}`;
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    return { slug, status: res.status, ok: res.status === 200 };
  } catch (e) {
    return { slug, status: 'ERR', ok: false, error: String(e) };
  }
}

async function main() {
  const slugs = loadSlugs();
  console.log(`Checking ${slugs.length} unique leetcode slugs against neetcode.io/solutions/...`);
  const results = [];
  const CONCURRENCY = 10;
  let i = 0;
  async function worker() {
    while (i < slugs.length) {
      const idx = i++;
      const r = await checkSlug(slugs[idx]);
      results.push(r);
      if (results.length % 50 === 0) console.log(`  ${results.length}/${slugs.length}...`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const failures = results.filter((r) => !r.ok);
  console.log(`\nDone. ${results.length - failures.length}/${results.length} resolved (200).`);
  if (failures.length) {
    console.log(`Failures (${failures.length}):`);
    for (const f of failures) console.log(`  ${f.status}  ${f.slug}`);
  }
  fs.writeFileSync(
    path.join(ROOT, 'data-pipeline/sources/neetcode-solutions-check.json'),
    JSON.stringify(results, null, 2)
  );
}

main();
