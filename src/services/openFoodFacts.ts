import type { Food } from '@/domain/food';
import { buildQueries, rankFoods, sanitizeQuery } from '@/domain/foodSearch';

// Open Food Facts: free, no key. Asks API users to send an identifying User-Agent.
const UA = 'Compound/1.0 (personal food log; iOS)';
const TIMEOUT_MS = 15_000;
const FIELDS = 'code,product_name,brands,quantity,product_quantity,product_quantity_unit,serving_size,serving_quantity,nutriments,countries_tags';

type Nutriments = Record<string, number | string | undefined>;
type Raw = {
  code?: string;
  product_name?: string;
  brands?: string | string[];
  quantity?: string;
  product_quantity?: number | string;
  serving_quantity?: number | string;
  nutriments?: Nutriments;
  countries_tags?: string[];
};

const n = (v: unknown): number | null => {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null;
};

const KJ_PER_KCAL = 4.184;

/** Per-100g value, preferring "as sold"; falls back to "as prepared" (flagged). */
function per100(nut: Nutriments, key: string): { v: number | null; prepared: boolean } {
  const sold = n(nut[`${key}_100g`]);
  if (sold !== null) return { v: sold, prepared: false };
  const prep = n(nut[`${key}_prepared_100g`]);
  return { v: prep, prepared: prep !== null };
}

/** Returns null when there is no usable energy value (the caller should offer manual entry). */
export function toFood(raw: Raw, fallbackCode = ''): Food | null {
  const nut = raw.nutriments ?? {};
  let kcal = per100(nut, 'energy-kcal');
  if (kcal.v === null) {
    const kj = per100(nut, 'energy-kj');
    kcal = { v: kj.v === null ? null : kj.v / KJ_PER_KCAL, prepared: kj.prepared };
  }
  if (kcal.v === null) return null;
  const protein = per100(nut, 'proteins');
  const carbs = per100(nut, 'carbohydrates');
  const fat = per100(nut, 'fat');
  const brand = Array.isArray(raw.brands) ? raw.brands[0] ?? '' : (raw.brands ?? '').split(',')[0].trim();
  const name = (raw.product_name ?? '').trim();
  if (!name && !brand) return null;
  return {
    barcode: raw.code ?? fallbackCode,
    name: name || brand,
    brand,
    kcal100: Math.round(kcal.v * 10) / 10,
    protein100: protein.v ?? 0,
    carbs100: carbs.v ?? 0,
    fat100: fat.v ?? 0,
    packG: n(raw.product_quantity),
    servingG: n(raw.serving_quantity),
    prepared: kcal.prepared || undefined,
    indian: raw.countries_tags?.includes('en:india') || undefined,
  };
}

/** UPC-A (12) and EAN-13 (13, leading 0) are the same product; try both spellings. */
export const barcodeCandidates = (code: string): string[] => {
  const c = code.replace(/\D/g, '');
  const out = [c];
  if (c.length === 12) out.push('0' + c);
  if (c.length === 13 && c.startsWith('0')) out.push(c.slice(1));
  return out;
};

/** Thrown when the caller's own AbortSignal cancels a request (not a timeout). */
export class RequestCancelled extends Error {
  constructor() {
    super('Request cancelled.');
    this.name = 'RequestCancelled';
  }
}

async function getJson(url: string, external?: AbortSignal): Promise<unknown> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, TIMEOUT_MS);
  const onExternalAbort = () => ctrl.abort();
  if (external?.aborted) {
    clearTimeout(timer);
    throw new RequestCancelled();
  }
  external?.addEventListener('abort', onExternalAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 404) return null; // OFF answers 404 for unknown barcodes
    if (!res.ok) throw new Error(`Open Food Facts HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (external?.aborted) throw new RequestCancelled();
    if (timedOut || (e instanceof Error && e.name === 'AbortError')) throw new Error('Open Food Facts timed out.');
    throw e instanceof Error ? e : new Error('Network error.');
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
  }
}

export type Lookup =
  | { kind: 'found'; food: Food }
  | { kind: 'incomplete'; name: string; brand: string; barcode: string; packG: number | null } // in OFF but no nutrition
  | { kind: 'missing' };

export async function lookupBarcode(code: string): Promise<Lookup> {
  let partial: Lookup | null = null;
  for (const c of barcodeCandidates(code)) {
    const json = (await getJson(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(c)}.json?fields=${FIELDS}`,
    )) as { status?: number; product?: Raw } | null;
    if (!json || json.status !== 1 || !json.product) continue;
    const food = toFood(json.product, c);
    if (food) return { kind: 'found', food };
    const p = json.product;
    partial ??= {
      kind: 'incomplete',
      name: (p.product_name ?? '').trim(),
      brand: (Array.isArray(p.brands) ? p.brands[0] : (p.brands ?? '').split(',')[0]) ?? '',
      barcode: c,
      packG: n(p.product_quantity),
    };
  }
  return partial ?? { kind: 'missing' };
}

/**
 * Name search (search-a-licious). The API matches loosely ("amul pan" returns unrelated
 * "Pommes de terre"), so we query India-scoped + global in parallel, then filter/rank locally:
 * every typed word must prefix-match brand/name, Indian products first.
 */
export async function searchFoods(query: string, limit = 12, signal?: AbortSignal): Promise<Food[]> {
  const clean = sanitizeQuery(query);
  if (clean.length < 2) return [];
  const qs = buildQueries(clean);
  const fetchHits = async (q: string, size: number): Promise<Food[]> => {
    const json = (await getJson(
      `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=${size}&fields=${FIELDS}`,
      signal,
    )) as { hits?: Raw[] } | null;
    return (json?.hits ?? []).map((h) => toFood(h)).filter((f): f is Food => f !== null);
  };
  const [india, global] = await Promise.allSettled([fetchHits(qs.india, 40), fetchHits(qs.global, 40)]);
  if (signal?.aborted) throw new RequestCancelled();
  if (india.status === 'rejected' && global.status === 'rejected') {
    throw india.reason instanceof Error ? india.reason : new Error('Search failed.');
  }
  const lists = [india, global].map((r) => (r.status === 'fulfilled' ? r.value : []));
  return rankFoods(clean, lists, limit);
}
