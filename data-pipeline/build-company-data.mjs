import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Sources
const scratchDir = 'C:\\Users\\shrey\\.gemini\\antigravity\\brain\\5e8c5693-cc55-44f5-bd00-23cd7dcbdd95\\scratch';
const ceetcodeFile = path.join(scratchDir, 'ceetcode_all.json');
const liquidslrDir = path.join(scratchDir, 'liquidslr_repo');
const hyntsFile = path.join(scratchDir, 'hynts_questions.json');
const nishantFile = path.join(scratchDir, 'nishant_readme.md');

// Destination
const outDir = path.join(rootDir, 'public', 'data', 'companies');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Parse Nishant pattern tips
const tipsMap = new Map();
if (fs.existsSync(nishantFile)) {
  const nishantText = fs.readFileSync(nishantFile, 'utf8');
  const lines = nishantText.split('\n');
  for (const line of lines) {
    if (line.startsWith('|') && !line.includes('Company Name') && !line.includes('---')) {
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        const compNorm = parts[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        tipsMap.set(compNorm, parts[2]);
      }
    }
  }
}
console.log(`Parsed ${tipsMap.size} tips from Nishant Tiwari`);

function normalizeSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractLeetcodeSlug(url) {
  if (!url) return null;
  const m = url.match(/leetcode\.com\/problems\/([a-z0-9\-]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function cleanDifficulty(diff) {
  if (!diff) return 'Medium';
  const d = diff.trim().toUpperCase();
  if (d === 'EASY') return 'Easy';
  if (d === 'HARD') return 'Hard';
  return 'Medium';
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Map: normKey -> { id, name, questions: Map<slug, question> }
const companies = new Map();

// Canonical display name map for known companies
const CANONICAL_NAMES = {
  google: 'Google',
  amazon: 'Amazon',
  meta: 'Meta',
  microsoft: 'Microsoft',
  apple: 'Apple',
  netflix: 'Netflix',
  uber: 'Uber',
  bloomberg: 'Bloomberg',
  goldmansachs: 'Goldman Sachs',
  adobe: 'Adobe',
  salesforce: 'Salesforce',
  linkedin: 'LinkedIn',
  oracle: 'Oracle',
  tiktok: 'TikTok',
  nvidia: 'Nvidia',
  flipkart: 'Flipkart',
  tcs: 'TCS',
  infosys: 'Infosys',
  wipro: 'Wipro',
  cognizant: 'Cognizant',
  capgemini: 'Capgemini',
  accenture: 'Accenture',
  walmart: 'Walmart',
  walmartlabs: 'Walmart',
  paypal: 'PayPal',
  stripe: 'Stripe',
  atlassian: 'Atlassian',
  intuit: 'Intuit',
  swiggy: 'Swiggy',
  zomato: 'Zomato',
  zepto: 'Zepto',
  cred: 'CRED',
  razorpay: 'Razorpay',
  phonepe: 'PhonePe',
  meesho: 'Meesho',
  paytm: 'Paytm',
  servicenow: 'ServiceNow',
  jpmorgan: 'JPMorgan Chase',
  jpmorganchase: 'JPMorgan Chase',
  morganstanley: 'Morgan Stanley',
  cisco: 'Cisco',
  visa: 'Visa',
  mastercard: 'Mastercard',
  barclays: 'Barclays',
  hsbc: 'HSBC',
  deshaw: 'D.E. Shaw',
  towerresearch: 'Tower Research',
  bytedance: 'ByteDance',
  tesla: 'Tesla',
  airbnb: 'Airbnb',
  spotify: 'Spotify',
  twitter: 'Twitter / X',
  ibm: 'IBM',
  zoho: 'Zoho',
  snap: 'Snap',
  snapchat: 'Snap',
  square: 'Block (Square)',
  block: 'Block (Square)',
  twosigma: 'Two Sigma',
  janestreet: 'Jane Street',
  palantir: 'Palantir',
  purestorage: 'Pure Storage',
  electronicarts: 'Electronic Arts',
  hudsonrivertrading: 'Hudson River Trading',
  jumptrading: 'Jump Trading',
  point72: 'Point72',
  citadel: 'Citadel',
  arista: 'Arista Networks',
  aristanetworks: 'Arista Networks',
  booking: 'Booking.com',
  bookingcom: 'Booking.com',
  americanexpress: 'American Express',
  expedia: 'Expedia',
  doordash: 'DoorDash',
  lyft: 'Lyft',
  reddit: 'Reddit',
  pinterest: 'Pinterest',
  dropbox: 'Dropbox',
};

const FEATURED_COMPANIES = new Set([
  'google', 'amazon', 'meta', 'microsoft', 'apple', 'netflix', 'uber', 'bloomberg',
  'goldmansachs', 'adobe', 'salesforce', 'linkedin', 'oracle', 'tiktok', 'nvidia',
  'flipkart', 'tcs', 'infosys', 'zoho', 'walmartlabs', 'walmart', 'paypal', 'stripe',
  'atlassian', 'swiggy', 'zomato', 'zepto', 'cred', 'razorpay'
]);

function getOrCreateCompany(rawId, rawName) {
  const norm = normalizeSlug(rawId);
  if (!companies.has(norm)) {
    const slug = rawId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const displayName = CANONICAL_NAMES[norm] || rawName;
    companies.set(norm, {
      id: slug,
      name: displayName,
      questions: new Map(),
    });
  }
  const comp = companies.get(norm);
  if (CANONICAL_NAMES[norm]) {
    comp.name = CANONICAL_NAMES[norm];
  } else if (rawName.length > comp.name.length || !/^[A-Z]/.test(comp.name)) {
    comp.name = rawName;
  }
  return comp;
}

// 1. Liquidslr Ingestion
if (fs.existsSync(liquidslrDir)) {
  console.log('Processing liquidslr dataset...');
  const dirs = fs.readdirSync(liquidslrDir).filter(d => !d.startsWith('.') && fs.statSync(path.join(liquidslrDir, d)).isDirectory());
  for (const d of dirs) {
    const comp = getOrCreateCompany(d, d);
    const compDir = path.join(liquidslrDir, d);
    
    const timeframes = [
      { file: '1. Thirty Days.csv', tag: '30 Days' },
      { file: '2. Three Months.csv', tag: '3 Months' },
      { file: '3. Six Months.csv', tag: '6 Months' },
      { file: '4. More Than Six Months.csv', tag: '6+ Months' },
      { file: '5. All.csv', tag: 'All Time' },
    ];

    for (const tf of timeframes) {
      const filePath = path.join(compDir, tf.file);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      const rows = content.trim().split('\n').slice(1);
      for (const r of rows) {
        if (!r.trim()) continue;
        const cols = parseCSVLine(r);
        if (cols.length >= 5) {
          const difficulty = cleanDifficulty(cols[0]);
          const title = cols[1];
          const freq = parseFloat(cols[2]) || 0;
          const acceptanceRaw = parseFloat(cols[3]);
          const acceptance = !isNaN(acceptanceRaw) ? `${(acceptanceRaw * 100).toFixed(1)}%` : null;
          const link = cols[4];
          const slug = extractLeetcodeSlug(link) || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const topics = cols[5] ? cols[5].split(',').map(t => t.trim()).filter(Boolean) : [];

          if (!comp.questions.has(slug)) {
            comp.questions.set(slug, {
              slug,
              title,
              difficulty,
              acceptance,
              frequency: freq,
              topics,
              timeframe: tf.tag,
              links: {
                leetcode: `https://leetcode.com/problems/${slug}/`,
              },
            });
          } else {
            const existing = comp.questions.get(slug);
            if (freq > existing.frequency) existing.frequency = freq;
            if (topics.length > existing.topics.length) existing.topics = topics;
            if (!existing.acceptance && acceptance) existing.acceptance = acceptance;
          }
        }
      }
    }
  }
}

// 2. CeetCode Ingestion
if (fs.existsSync(ceetcodeFile)) {
  console.log('Processing CeetCode dataset...');
  const ceetcode = JSON.parse(fs.readFileSync(ceetcodeFile, 'utf8'));
  for (const [ceetKey, data] of Object.entries(ceetcode)) {
    const comp = getOrCreateCompany(ceetKey, data.label);
    for (const q of data.questions) {
      const slug = extractLeetcodeSlug(q.leetcodelink) || q.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const difficulty = cleanDifficulty(q.difficulty);
      const freq = parseFloat(q.frequency) || 0;
      const acceptance = q.acceptance || null;
      
      if (!comp.questions.has(slug)) {
        comp.questions.set(slug, {
          slug,
          title: q.title,
          difficulty,
          acceptance,
          frequency: freq,
          topics: [],
          timeframe: 'All Time',
          links: {
            leetcode: `https://leetcode.com/problems/${slug}/`,
          },
        });
      } else {
        const existing = comp.questions.get(slug);
        if (!existing.acceptance && acceptance) existing.acceptance = acceptance;
        if (freq > existing.frequency) existing.frequency = freq;
      }
    }
  }
}

// 3. Hynts Ingestion
if (fs.existsSync(hyntsFile)) {
  console.log('Processing Hynts dataset...');
  const hynts = JSON.parse(fs.readFileSync(hyntsFile, 'utf8'));
  for (const [hyntsComp, questionSlugs] of Object.entries(hynts)) {
    const comp = getOrCreateCompany(hyntsComp, hyntsComp);
    for (const slug of questionSlugs) {
      if (!comp.questions.has(slug)) {
        const title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        comp.questions.set(slug, {
          slug,
          title,
          difficulty: 'Medium',
          acceptance: null,
          frequency: 85,
          topics: [],
          timeframe: 'Curated',
          links: {
            leetcode: `https://leetcode.com/problems/${slug}/`,
          },
        });
      }
    }
  }
}

// Build index & company question files
console.log('Generating per-company JSON files and manifest...');
const companyList = [];
let totalProblemsEmitted = 0;

for (const [norm, comp] of companies.entries()) {
  const qList = Array.from(comp.questions.values());
  if (qList.length === 0) continue;

  // Sort by frequency descending, then by title
  qList.sort((a, b) => (b.frequency || 0) - (a.frequency || 0) || a.title.localeCompare(b.title));

  let easy = 0;
  let medium = 0;
  let hard = 0;

  const formattedQuestions = qList.map((q, idx) => {
    if (q.difficulty === 'Easy') easy++;
    else if (q.difficulty === 'Hard') hard++;
    else medium++;

    return {
      id: `comp-${comp.id}-${q.slug}`,
      slug: q.slug,
      title: q.title,
      difficulty: q.difficulty,
      acceptance: q.acceptance,
      frequency: Math.round((q.frequency || 0) * 10) / 10,
      topics: q.topics || [],
      timeframe: q.timeframe || 'All Time',
      links: q.links,
    };
  });

  // Check pattern tip
  const tip = tipsMap.get(norm) || tipsMap.get(normalizeSlug(comp.name)) || null;
  const isFeatured = FEATURED_COMPANIES.has(norm) || FEATURED_COMPANIES.has(comp.id);

  const meta = {
    id: comp.id,
    name: comp.name,
    total: formattedQuestions.length,
    easy,
    medium,
    hard,
    interviewTip: tip,
    featured: isFeatured,
  };

  companyList.push(meta);

  // Write company file
  const compFile = path.join(outDir, `${comp.id}.json`);
  fs.writeFileSync(compFile, JSON.stringify(formattedQuestions, null, 0));
  totalProblemsEmitted += formattedQuestions.length;
}

// Sort companyList: featured first, then by total questions descending
companyList.sort((a, b) => {
  if (a.featured && !b.featured) return -1;
  if (!a.featured && b.featured) return 1;
  return b.total - a.total;
});

// Write index.json in public/data/companies/
const indexFile = path.join(outDir, 'index.json');
fs.writeFileSync(indexFile, JSON.stringify(companyList, null, 2));

// Also write src/data/companies.json for instant synchronous load in the client bundle
const srcDataFile = path.join(rootDir, 'src', 'data', 'companies.json');
fs.writeFileSync(srcDataFile, JSON.stringify(companyList, null, 2));

console.log(`\nSUCCESS!`);
console.log(`Total companies: ${companyList.length}`);
console.log(`Total problem entries: ${totalProblemsEmitted}`);
console.log(`Wrote index to ${indexFile} and ${srcDataFile}`);
console.log(`Per-company files stored in ${outDir}`);
