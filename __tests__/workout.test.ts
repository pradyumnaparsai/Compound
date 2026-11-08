import {
  completedSetCount,
  epley1RM,
  exerciseVolume,
  formatDuration,
  groupBySuperset,
  linkWithNext,
  normalizeSupersets,
  setLabels,
  setVolume,
  setWarning,
  supersetBadges,
  unlinkExercise,
  workoutDurationSeconds,
  workoutVolume,
} from '@/domain/workout';
import { ex, set, workout } from '../testutils/workoutFixtures';

describe('1RM (Epley)', () => {
  it('is w × (1 + reps/30)', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 3);
    expect(epley1RM(60, 5)).toBeCloseTo(70, 9);
  });
  it('is 0 without load or reps', () => {
    expect(epley1RM(0, 5)).toBe(0);
    expect(epley1RM(-20, 5)).toBe(0);
    expect(epley1RM(100, 0)).toBe(0);
  });
});

describe('set labels', () => {
  it('numbers normal sets only; W/D/F otherwise', () => {
    const sets = [set(40, 10, { type: 'warmup' }), set(80, 8), set(80, 8), set(60, 8, { type: 'dropset' }), set(80, 6, { type: 'failure' }), set(80, 5)];
    expect(setLabels(sets)).toEqual(['W', '1', '2', 'D', 'F', '3']);
  });
});

describe('volume', () => {
  it('counts completed sets only and excludes warm-ups by default', () => {
    const e = ex('a', [set(40, 10, { type: 'warmup' }), set(100, 5), set(100, 5, { isCompleted: false }), set(80, 8, { type: 'dropset' })]);
    expect(exerciseVolume(e, 'weight_reps')).toBe(100 * 5 + 80 * 8);
    expect(exerciseVolume(e, 'weight_reps', { includeWarmup: true })).toBe(40 * 10 + 100 * 5 + 80 * 8);
  });
  it('bodyweight adds the body weight; assisted subtracts the assistance', () => {
    expect(setVolume(set(10, 5), 'bodyweight_reps', { bodyweightKg: 80 })).toBe(90 * 5);
    expect(setVolume(set(0, 5), 'bodyweight_reps')).toBe(0);
    expect(setVolume(set(-30, 6), 'bodyweight_assisted_reps', { bodyweightKg: 80 })).toBe(50 * 6);
    expect(setVolume(set(-30, 6), 'bodyweight_assisted_reps')).toBe(0);
    expect(setVolume(set(-200, 6), 'bodyweight_assisted_reps', { bodyweightKg: 80 })).toBe(0);
  });
  it('time and reps-only types have no volume', () => {
    expect(setVolume(set(20, 10), 'reps_only')).toBe(0);
    expect(setVolume(set(20, null, { durationSeconds: 60 }), 'weight_duration')).toBe(0);
  });
  it('sums a workout using the exercise type lookup', () => {
    const w = workout('2026-01-01', [ex('bench', [set(100, 5)]), ex('pullup', [set(0, 10)])]);
    const typeOf = (id: string) => (id === 'pullup' ? ('bodyweight_reps' as const) : ('weight_reps' as const));
    expect(workoutVolume(w, typeOf, { bodyweightKg: 80 })).toBe(500 + 800);
    expect(workoutVolume(w, typeOf)).toBe(500);
    expect(completedSetCount(w)).toBe(2);
  });
});

describe('duration and warnings', () => {
  it('formats and measures duration', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3909)).toBe('1:05:09');
    expect(workoutDurationSeconds({ startedAt: '2026-01-01T10:00:00.000Z', endedAt: '2026-01-01T10:45:30.000Z' })).toBe(2730);
  });
  it('flags implausible values', () => {
    expect(setWarning(set(100, 5))).toBeNull();
    expect(setWarning(set(1000, 5))).toMatch(/weight/i);
    expect(setWarning(set(50, 500))).toMatch(/reps/i);
    expect(setWarning(set(null, null, { durationSeconds: 99999 }))).toMatch(/duration/i);
  });
});

describe('supersets', () => {
  const mk = (...ids: (string | null)[]) => ids.map((supersetId, i) => ({ k: i, supersetId }));

  it('groups adjacent exercises with the same id', () => {
    const groups = groupBySuperset(mk('x', 'x', null, 'y', 'y', 'y'));
    expect(groups.map((g) => g.map((e) => e.k))).toEqual([[0, 1], [2], [3, 4, 5]]);
  });
  it('normalize clears singletons and splits non-contiguous groups', () => {
    expect(normalizeSupersets(mk('x', null, 'x')).map((e) => e.supersetId)).toEqual([null, null, null]);
    expect(normalizeSupersets(mk('x', 'x', null, 'x', 'x')).map((e) => e.supersetId)).toEqual(['x', 'x', null, 'x~1', 'x~1']);
  });
  it('links with the next exercise, joining an existing group', () => {
    const linked = linkWithNext(mk(null, null, null), 0, () => 'new');
    expect(linked.map((e) => e.supersetId)).toEqual(['new', 'new', null]);
    const joined = linkWithNext(linked, 1, () => 'other');
    expect(joined.map((e) => e.supersetId)).toEqual(['new', 'new', 'new']);
    expect(linkWithNext(mk(null, null), 1, () => 'n').map((e) => e.supersetId)).toEqual([null, null]);
  });
  it('unlinking dissolves a pair but keeps a bigger group', () => {
    expect(unlinkExercise(mk('x', 'x'), 0).map((e) => e.supersetId)).toEqual([null, null]);
    expect(unlinkExercise(mk('x', 'x', 'x'), 2).map((e) => e.supersetId)).toEqual(['x', 'x', null]);
    // pulling the middle one out leaves two isolated members, which are no longer a superset
    expect(unlinkExercise(mk('x', 'x', 'x'), 1).map((e) => e.supersetId)).toEqual([null, null, null]);
  });
  it('labels groups A, B in display order', () => {
    expect(supersetBadges(mk('p', 'p', null, 'q', 'q'))).toEqual(['A', 'A', null, 'B', 'B']);
  });
});
