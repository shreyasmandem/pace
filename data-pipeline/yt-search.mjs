// Dev helper: search YouTube and print candidate videos (id | title | channel | length).
// Usage: node data-pipeline/yt-search.mjs "query one" "query two" ...
const queries = process.argv.slice(2);

async function search(q) {
  const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US' },
  });
  const html = await res.text();
  const out = [];
  const re = /"videoRenderer":\{"videoId":"([\w-]{11})"([\s\S]*?)"ownerText":\{"runs":\[\{"text":"(.*?)"/g;
  let m;
  while ((m = re.exec(html)) && out.length < 6) {
    const title = (m[2].match(/"title":\{"runs":\[\{"text":"(.*?)"\}/) || [])[1] || '?';
    const len = (m[2].match(/"lengthText":\{"accessibility":\{[\s\S]*?\},"simpleText":"([\d:]+)"/) || [])[1] || '';
    out.push(`${m[1]} | ${title} | ${m[3]} | ${len}`);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const q of queries) {
  console.log(`\n## ${q}`);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      for (const line of await search(q)) console.log('  ' + line);
      break;
    } catch (e) {
      if (attempt === 3) console.log('  ERROR', e.message);
      await sleep(4000 * attempt);
    }
  }
  await sleep(1500);
}
