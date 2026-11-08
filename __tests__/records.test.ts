import { detectPRs, exerciseProgress, type PR } from '@/domain/records';
import { ex, set, workout } from '../testutils/workoutFixtures';

const typeOf = (id: string) => (id === 'pullup' ? ('bodyweight_reps' as const) : id === 'plank' ? ('duration' as const) : ('weight_reps' as const));
const kinds = (prs: PR[]) => prs.map((p) => p.kind).sort();

describe('detectPRs', () => {
  const history = [workout('2026-01-01', [ex('bench', [set(100, 5), set(60, 12, { type: 'warmup' })])])];

  it('has no PRs for an exercise with no history', () => {
    expect(detectPRs([], workout('2026-02-01', [ex('bench', [set(100, 5)])]), typeOf)).toEqual([]);
  });

  it('detects heaviest weight, 1RM, reps at weight and set volume', () => {
    const cur = workout('2026-02-01', [ex('bench', [set(105, 5)])]);
    expect(kinds(detectPRs(history, cur, typeOf))).toEqual(['oneRM', 'reps', 'setVolume', 'weight'].sort());
  });

  it('ties are not PRs', () => {
    expect(detectPRs(history, workout('2026-02-01', [ex('bench', [set(100, 5)])]), typeOf)).toEqual([]);
  });

  it('warm-up sets never count, in history or in the current workout', () => {
    // history warm-up 60×12 must not be the baseline for reps; current warm-up 200 must not be a PR
    const cur = workout('2026-02-01', [ex('bench', [set(200, 10, { type: 'warmup' }), set(100, 5)])]);
    expect(detectPRs(history, cur, typeOf)).toEqual([]);
    const lighter = workout('2026-02-01', [ex('bench', [set(60, 13)])]);
    // 60×13 beats all previous counted sets at ≥60 kg (100×5 only): most reps at a weight
    expect(kinds(detectPRs(history, lighter, typeOf))).toContain('reps');
  });

  it('ignores unfinished sets', () => {
    const cur = workout('2026-02-01', [ex('bench', [set(150, 5, { isCompleted: false })])]);
    expect(detectPRs(history, cur, typeOf)).toEqual([]);
  });

  it('awards each kind once per workout, to the best set', () => {
    const cur = workout('2026-02-01', [ex('bench', [set(110, 5), set(105, 5)])]);
    const weight = detectPRs(history, cur, typeOf).filter((p) => p.kind === 'weight');
    expect(weight).toHaveLength(1);
    expect(weight[0].value).toBe(110);
  });

  it('does not compare a workout with itself', () => {
    const cur = workout('2026-02-01', [ex('bench', [set(120, 5)])]);
    expect(kinds(detectPRs([...history, cur], cur, typeOf)).length).toBeGreaterThan(0);
  });

  it('reps-only and duration exercises', () => {
    const h = [workout('2026-01-01', [ex('pushup', [set(null, 20)]), ex('plank', [set(null, null, { durationSeconds: 60 })])])];
    const cur = workout('2026-02-01', [ex('pushup', [set(null, 25)]), ex('plank', [set(null, null, { durationSeconds: 75 })])]);
    const t = (id: string) => (id === 'pushup' ? ('reps_only' as const) : ('duration' as const));
    expect(detectPRs(h, cur, t).map((p) => `${p.exerciseId}:${p.kind}`).sort()).toEqual(['plank:duration', 'pushup:reps']);
  });
});

describe('exerciseProgress', () => {
  it('returns best weight, best 1RM and volume per date, excluding warm-ups', () => {
    const ws = [
      workout('2026-02-01', [ex('bench', [set(100, 5), set(90, 8)])]),
      workout('2026-01-01', [ex('bench', [set(80, 10), set(40, 10, { type: 'warmup' })]), ex('squat', [set(200, 1)])]),
    ];
    const p = exerciseProgress(ws, 'bench', 'weight_reps');
    expect(p.map((x) => x.date)).toEqual(['2026-01-01', '2026-02-01']);
    expect(p[0]).toMatchObject({ bestWeightKg: 80, volume: 800 });
    expect(p[0].best1RM).toBeCloseTo(80 * (1 + 10 / 30), 6);
    expect(p[1]).toMatchObject({ bestWeightKg: 100, volume: 500 + 720 });
  });
});
