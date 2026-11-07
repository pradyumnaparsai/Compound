import type { Food } from './food';

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const tokenize = (s: string): string[] => normalize(s).split(' ').filter(Boolean);

/** Removes Lucene operators so user text can't break (or inject into) the OFF query. */
export const sanitizeQuery = (q: string): string => tokenize(q).join(' ');

/** Index-0 query is the India-scoped one; index-1 is global. */
export const INDIA_FILTER = 'countries_tags:"en:india"';
export const buildQueries = (q: string): { india: string; global: string } => {
  const clean = sanitizeQuery(q);
  return { global: clean, india: `${clean} ${INDIA_FILTER}` };
};

const haystack = (f: Food) => tokenize(`${f.brand} ${f.name}`);

/**
 * How well a food matches the typed text, or -1 if it doesn't match.
 * Every typed word must match the START of some word in brand+name
 * (the last word may be a half-typed prefix; earlier words must be whole or prefix too,
 * so "amul pan" matches "Amul Paneer" but not "Pommes de terre").
 * Higher = better.
 */
export function matchScore(f: Food, query: string): number {
  const qt = tokenize(query);
  if (qt.length === 0) return -1;
  const words = haystack(f);
  let score = 0;
  for (let i = 0; i < qt.length; i++) {
    const t = qt[i];
    if (words.includes(t)) score += 3; // whole-word hit
    else if (words.some((w) => w.startsWith(t))) score += i === qt.length - 1 ? 2 : 1; // prefix hit
    else return -1;
  }
  const title = words.join(' ');
  const q = qt.join(' ');
  const nameOnly = tokenize(f.name).join(' ');
  if (title.startsWith(q) || nameOnly.startsWith(q)) score += 4;
  else if (title.includes(q)) score += 2;
  if (nameOnly === q) score += 2; // exact product name
  // brand typed first ("amul butter") is the common case
  if (f.brand && normalize(f.brand).startsWith(qt[0])) score += 1;
  return score;
}

const dedupeKey = (f: Food) => (f.barcode ? `b:${f.barcode}` : `n:${normalize(foodKey(f))}`);
const foodKey = (f: Food) => `${f.brand} ${f.name}`;

/**
 * Merges India-scoped and global hits: matching hits only, Indian products first,
 * then by text-match score, API order as the final tiebreak. If nothing matches
 * strictly (typos like "paner"), falls back to API order, still Indian first.
 */
export function rankFoods(query: string, lists: Food[][], limit: number): Food[] {
  const seen = new Set<string>();
  const all: { f: Food; order: number }[] = [];
  let order = 0;
  for (const list of lists) {
    for (const f of list) {
      const k = dedupeKey(f);
      if (seen.has(k)) continue;
      seen.add(k);
      all.push({ f, order: order++ });
    }
  }
  const scored = all.map((x) => ({ ...x, s: matchScore(x.f, query) }));
  const strict = scored.filter((x) => x.s >= 0);
  const pool = strict.length > 0 ? strict : scored; // typo fallback
  pool.sort(
    (a, b) =>
      Number(!!b.f.indian) - Number(!!a.f.indian) || b.s - a.s || a.order - b.order,
  );
  return pool.slice(0, limit).map((x) => x.f);
}
