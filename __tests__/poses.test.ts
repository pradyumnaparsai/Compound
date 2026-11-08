import { SEED_EXERCISES } from '@/domain/exerciseCatalog';
import { layoutPattern, patternFor, PATTERNS, SEED_SLUGS_WITH_PATTERN, type PatternName } from '@/domain/poses';

describe('pose animations', () => {
  it('every built-in exercise has an animation, and every mapped slug exists', () => {
    const slugs = SEED_EXERCISES.map((e) => e.id.replace('seed:', ''));
    expect(slugs.filter((s) => !SEED_SLUGS_WITH_PATTERN.includes(s))).toEqual([]);
    expect(SEED_SLUGS_WITH_PATTERN.filter((s) => !slugs.includes(s))).toEqual([]);
    for (const e of SEED_EXERCISES) expect(PATTERNS).toHaveProperty(patternFor(e.id, e.primaryMuscle) as string);
  });

  it('custom exercises fall back to their main muscle, or nothing', () => {
    expect(patternFor('custom-1', 'biceps')).toBe('curl');
    expect(patternFor('custom-1', 'cardio')).toBe('run');
    expect(patternFor('custom-1', 'other')).toBeNull();
    expect(patternFor('custom-1')).toBeNull();
  });

  describe.each(Object.keys(PATTERNS) as PatternName[])('%s', (name) => {
    const size = 100;
    const lay = layoutPattern(name, size);
    it('stays inside its box with rigid limbs', () => {
      for (const p of lay.parts) {
        expect(p.cx).toHaveLength(lay.frames);
        for (let i = 0; i < lay.frames; i++) {
          expect(p.cx[i]).toBeGreaterThanOrEqual(-1);
          expect(p.cx[i]).toBeLessThanOrEqual(size + 1);
          expect(p.cy[i]).toBeGreaterThanOrEqual(-1);
          expect(p.cy[i]).toBeLessThanOrEqual(size + 1);
          expect(Number.isFinite(p.rot[i])).toBe(true);
          if (i > 0) expect(Math.abs(p.rot[i] - p.rot[i - 1])).toBeLessThan(120); // never spins the long way round
        }
      }
    });
    it('has a body and a head', () => {
      expect(lay.parts.map((p) => p.key)).toEqual(expect.arrayContaining(['torso', 'thigh', 'shin', 'uarm', 'farm']));
      expect(lay.head.r).toBeGreaterThan(0);
    });
  });

  it('static holds do not animate; movements do', () => {
    expect(layoutPattern('hang', 80).animated).toBe(false);
    expect(layoutPattern('wallSit', 80).animated).toBe(false);
    expect(layoutPattern('squat', 80).animated).toBe(true);
  });
});
