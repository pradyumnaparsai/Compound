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

  it('exercises that were drawn wrongly now use a pose that matches the movement', () => {
    expect(patternFor('seed:pec-deck', 'chest')).toBe('pecDeck');
    expect(patternFor('seed:reverse-pec-deck', 'shoulders')).toBe('reverseFlyMachine');
    expect(patternFor('hevy:lying-leg-curl-machine', 'hamstrings')).toBe('lyingLegCurl');
    expect(patternFor('hevy:leg-raise-parallel-bars', 'abs')).toBe('parallelBarLegRaise');
    expect(patternFor('hevy:unknown-thing', 'biceps')).toBe('curl'); // unknown imports still fall back to the muscle
  });

  it('a face-down pad sits under the chest, not above it', () => {
    const lay = layoutPattern('lyingLegCurl', 100);
    const torso = lay.parts.find((p) => p.key === 'torso')!;
    const bench = lay.parts.find((p) => p.key === 'bench')!;
    expect(bench.cy[0]).toBeGreaterThan(torso.cy[0]);
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

  describe('cable exercises are drawn with a cable, not a dumbbell', () => {
    const cables: [string, PatternName][] = [
      ['seed:seated-cable-row', 'seatedRow'], ['seed:face-pull', 'facePull'], ['seed:lat-pulldown', 'pulldown'],
      ['seed:triceps-pushdown', 'pushdown'], ['seed:rope-triceps-pushdown', 'ropePushdown'], ['seed:cable-crunch', 'cableCrunch'],
      ['seed:cable-curl', 'cableCurl'], ['seed:cable-crossover', 'crossover'], ['seed:cable-overhead-triceps-extension', 'cableOverheadExt'],
      ['hevy:rear-delt-fly-cable', 'rearFlyCable'], ['hevy:lat-pulldown-machine', 'pulldown'], ['hevy:lat-pulldown-close-grip', 'pulldown'],
      ['hevy:single-arm-lateral-raise-cable', 'cableRaise'],
    ];
    it.each(cables)('%s → %s', (id, name) => {
      expect(patternFor(id)).toBe(name);
      const lay = layoutPattern(name, 100);
      const cable = lay.parts.find((p) => p.key === 'cable')!;
      expect(cable).toBeDefined();
      expect(cable.sx).toHaveLength(lay.frames);
      expect(cable.sx!.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
      expect(lay.parts.some((p) => p.key === 'grip')).toBe(true);
      expect(lay.load).toBeNull();
    });
    it('a rope has two prongs; a bar has one crossbar', () => {
      expect(layoutPattern('ropePushdown', 100).parts.some((p) => p.key === 'grip2')).toBe(true);
      expect(layoutPattern('pushdown', 100).parts.some((p) => p.key === 'grip2')).toBe(false);
    });
    it('the cable follows the hand: it stretches as the hand moves away from the pulley', () => {
      const sx = layoutPattern('seatedRow', 100).parts.find((p) => p.key === 'cable')!.sx!;
      expect(sx[sx.length - 1]).toBeGreaterThan(sx[0]);
    });
    it('machine and dumbbell variants keep their weight', () => {
      expect(patternFor('hevy:seated-row-machine')).toBe('machineRow');
      expect(layoutPattern('machineRow', 100).load).not.toBeNull();
      expect(patternFor('seed:rear-delt-fly')).toBe('rearFly');
      expect(layoutPattern('rearFly', 100).load).not.toBeNull();
    });
  });

  it('incline presses keep the elbows out of the pad and the hand above the elbow', () => {
    for (const name of ['inclineBench', 'inclineMachinePress'] as PatternName[]) {
      const p = PATTERNS[name];
      expect(p.b.uarm).toBeGreaterThanOrEqual(30); // elbow stays in front of the backrest instead of sinking into it
    }
  });

  it('static holds do not animate; movements do', () => {
    expect(layoutPattern('hang', 80).animated).toBe(false);
    expect(layoutPattern('wallSit', 80).animated).toBe(false);
    expect(layoutPattern('squat', 80).animated).toBe(true);
  });
});
