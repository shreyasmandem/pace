const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'to', 'is', 'are', 'and', 'or', 'with',
  'for', 'from', 'by', 'at', 'as', 'part', 'problem',
  'problems', 'algorithm', 'algorithms', 'using', 'vs', 'given', 'your', 'you',
  'learn', 'concept', 'concepts', 'basic', 'basics', 'introduction', 'approach',
  'approaches',
]);

export function normalize(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenSet(str) {
  return new Set(normalize(str).split(' ').filter((t) => t && !STOPWORDS.has(t)));
}

/**
 * Recall-based match score: what fraction of `query`'s meaningful tokens
 * appear anywhere in `candidate`. Denominator is always the query's size, so
 * a short, generic candidate segment can't cheaply "win" just because it's
 * short (the bug with plain min-size containment scoring).
 */
export function containmentScore(query, candidate) {
  const q = tokenSet(query);
  const c = tokenSet(candidate);
  if (q.size === 0 || c.size === 0) return 0;
  let hits = 0;
  for (const t of q) if (c.has(t)) hits += 1;
  return hits / q.size;
}

export function slugify(str) {
  return normalize(str).replace(/\s+/g, '-');
}
