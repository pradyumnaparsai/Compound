import type { Food } from '@/domain/food';
import { buildQueries, matchScore, rankFoods, sanitizeQuery } from '@/domain/foodSearch';

const f = (name: string, brand = '', extra: Partial<Food> = {}): Food => ({
  barcode: `${brand}-${name}`,
  name,
  brand,
  kcal100: 100,
  protein100: 1,
  carbs100: 1,
  fat100: 1,
  packG: null,
  servingG: null,
  ...extra,
});

describe('food text search', () => {
  it('sanitizes Lucene syntax', () => {
    expect(sanitizeQuery('  Amul: "Butter" (200g)* ')).toBe('amul butter 200g');
    expect(buildQueries('amul butter')).toEqual({ global: 'amul butter', india: 'amul butter countries_tags:"en:india"' });
  });

  it('requires every typed word to match, last word may be a prefix', () => {
    expect(matchScore(f('Paneer', 'Amul'), 'amul pan')).toBeGreaterThan(0);
    expect(matchScore(f('Pommes de terre', 'Pom Bistro'), 'amul pan')).toBe(-1);
    expect(matchScore(f('Maggie noodles'), 'maggi')).toBeGreaterThan(0);
  });

  it('ignores accents and punctuation', () => {
    expect(matchScore(f('Crème Brûlée'), 'creme brulee')).toBeGreaterThan(0);
    expect(matchScore(f('Parle-G Gluco'), 'parle g')).toBeGreaterThan(0);
  });

  it('ranks Indian products first, then better text matches, and dedupes', () => {
    const us = f('Paneer', 'Foo', { indian: undefined, barcode: '1' });
    const inLoose = f('Fresh Paneer Cubes', 'Milky Mist', { indian: true, barcode: '2' });
    const inExact = f('Paneer', 'Amul', { indian: true, barcode: '3' });
    const out = rankFoods('paneer', [[inLoose, inExact], [us, inExact]], 10);
    expect(out.map((x) => x.barcode)).toEqual(['3', '2', '1']);
  });

  it('falls back to API order for typos, still Indian first', () => {
    const a = f('Paneer', 'X', { barcode: 'a' });
    const b = f('Paneer', 'Y', { barcode: 'b', indian: true });
    expect(rankFoods('paner x', [[a, b]], 5).map((x) => x.barcode)).toEqual(['b', 'a']);
  });

  it('respects the limit', () => {
    const list = Array.from({ length: 20 }, (_, i) => f(`Paneer ${i}`, 'A', { barcode: String(i) }));
    expect(rankFoods('paneer', [list], 12)).toHaveLength(12);
  });
});
