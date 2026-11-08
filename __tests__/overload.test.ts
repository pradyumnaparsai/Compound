import { defaultPlateConfig, roundToLoadable, smallestStepKg, suggestNextWeight, warmupSets } from '@/domain/overload';
import { KG_PER_LB } from '@/domain/units';

const kg = defaultPlateConfig('kg');
const s = (w: number, r: number, setType = 'normal') => ({ weightKg: w, reps: r, setType });

describe('roundToLoadable', () => {
  it('rounds to pairs of the smallest plate above the bar', () => {
    expect(smallestStepKg(kg)).toBe(2.5);
    expect(roundToLoadable(61, kg)).toBe(60);
    expect(roundToLoadable(61.3, kg)).toBe(62.5);
    expect(roundToLoadable(20, kg)).toBe(20);
    expect(roundToLoadable(15, kg)).toBe(15);
  });
  it('uses lb plates in lb mode', () => {
    const lb = defaultPlateConfig('lb');
    expect(smallestStepKg(lb)).toBeCloseTo(5 * KG_PER_LB, 9);
    expect(roundToLoadable(136 * KG_PER_LB, lb) / KG_PER_LB).toBeCloseTo(135, 6);
  });
});

describe('suggestNextWeight', () => {
  const range = { min: 8, max: 12 };
  it('increases after reaching the top of the range on every set', () => {
    const r = suggestNextWeight([s(60, 12), s(60, 12), s(60, 12)], range, kg)!;
    expect(r).toMatchObject({ reason: 'increase', weightKg: 62.5 });
    expect(r.message).toMatch(/increased/i);
  });
  it('decreases when a set falls below the range', () => {
    const r = suggestNextWeight([s(60, 10), s(60, 7)], range, kg)!;
    expect(r).toMatchObject({ reason: 'decrease', weightKg: 57.5 });
    expect(r.message).toMatch(/below/i);
  });
  it('keeps the weight inside the range', () => {
    expect(suggestNextWeight([s(60, 10), s(60, 9)], range, kg)).toMatchObject({ reason: 'keep', weightKg: 60 });
  });
  it('ignores warm-ups and lighter drop sets; judges the heaviest weight', () => {
    const r = suggestNextWeight([s(30, 12, 'warmup'), s(60, 12), s(60, 12), s(40, 5, 'dropset')], range, kg)!;
    expect(r.reason).toBe('increase');
  });
  it('is null with nothing to judge or a bad range', () => {
    expect(suggestNextWeight([], range, kg)).toBeNull();
    expect(suggestNextWeight([s(30, 12, 'warmup')], range, kg)).toBeNull();
    expect(suggestNextWeight([s(60, 12)], { min: 12, max: 8 }, kg)).toBeNull();
  });
});

describe('warmupSets', () => {
  it('ramps by percentage rounded to loadable weights', () => {
    const w = warmupSets(100, kg);
    expect(w.map((x) => x.weightKg)).toEqual([40, 60, 80]);
    expect(w.map((x) => x.reps)).toEqual([8, 5, 3]);
  });
  it('never goes below the bar and drops duplicates', () => {
    const w = warmupSets(50, kg);
    expect(w.map((x) => x.weightKg)).toEqual([20, 30, 40]);
    expect(warmupSets(25, kg).map((x) => x.weightKg)).toEqual([20]);
  });
  it('is empty at or under the bar', () => {
    expect(warmupSets(20, kg)).toEqual([]);
    expect(warmupSets(0, kg)).toEqual([]);
  });
});
