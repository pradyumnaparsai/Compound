import { fillFromPrevious, formatDateLabel, formatDistance, formatPR, formatSet, formatVolume, hasSetData } from '@/domain/workoutFormat';
import { weightOn } from '@/domain/weight';
import { ex, set, workout } from '../testutils/workoutFixtures';

const blank = { weightKg: null, reps: null, durationSeconds: null, distanceMeters: null };

describe('formatSet', () => {
  it('formats each exercise type', () => {
    expect(formatSet({ ...blank, weightKg: 80, reps: 8 }, 'weight_reps', 'kg')).toBe('80 kg × 8');
    expect(formatSet({ ...blank, weightKg: 100, reps: 5 }, 'weight_reps', 'lb')).toBe('220.5 lb × 5');
    expect(formatSet({ ...blank, reps: 12 }, 'bodyweight_reps', 'kg')).toBe('× 12');
    expect(formatSet({ ...blank, weightKg: 10, reps: 6 }, 'bodyweight_reps', 'kg')).toBe('+10 kg × 6');
    expect(formatSet({ ...blank, weightKg: -30, reps: 5 }, 'bodyweight_assisted_reps', 'kg')).toBe('−30 kg × 5');
    expect(formatSet({ ...blank, durationSeconds: 90 }, 'duration', 'kg')).toBe('1:30');
    expect(formatSet({ ...blank, distanceMeters: 2500, durationSeconds: 720 }, 'distance_duration', 'kg')).toBe('2.5 km · 12:00');
    expect(formatSet(blank, 'weight_reps', 'kg')).toBe('–');
  });
});

describe('hasSetData / fillFromPrevious', () => {
  it('needs the fields of the type', () => {
    expect(hasSetData({ ...blank, reps: 5 }, 'weight_reps')).toBe(true);
    expect(hasSetData({ ...blank, weightKg: 50 }, 'weight_reps')).toBe(false);
    expect(hasSetData({ ...blank, durationSeconds: 30 }, 'duration')).toBe(true);
  });
  it('fills only missing numbers', () => {
    expect(fillFromPrevious({ ...blank, reps: 6 }, { ...blank, weightKg: 70, reps: 8 })).toMatchObject({ weightKg: 70, reps: 6 });
    const s = { ...blank, reps: 1 };
    expect(fillFromPrevious(s, null)).toBe(s);
  });
});

describe('misc formatting', () => {
  it('volume, distance and dates', () => {
    expect(formatVolume(1240, 'kg')).toBe('1,240 kg');
    expect(formatVolume(1000, 'lb')).toBe('2,205 lb');
    expect(formatDistance(800)).toBe('800 m');
    expect(formatDateLabel('2026-11-08', 2026)).toBe('Sun, 8 Nov');
    expect(formatDateLabel('2025-12-31', 2026)).toBe('Wed, 31 Dec 2025');
  });
  it('describes PRs', () => {
    const s = set(60, 12);
    const w = workout('2026-11-08', [ex('bench', [s])]);
    expect(formatPR({ exerciseId: 'bench', setId: s.id, kind: 'reps', value: 12 }, w, 'kg')).toBe('12 reps at 60 kg');
    expect(formatPR({ exerciseId: 'bench', setId: s.id, kind: 'weight', value: 60 }, w, 'kg')).toBe('60 kg');
    expect(formatPR({ exerciseId: 'bench', setId: s.id, kind: 'oneRM', value: 84 }, w, 'kg')).toBe('est. 84 kg');
  });
});

describe('weightOn', () => {
  const entries = [
    { date: '2026-10-01', kg: 82, loggedAt: 'x' },
    { date: '2026-10-20', kg: 80, loggedAt: 'x' },
  ];
  it('uses the latest entry on or before, else the earliest after', () => {
    expect(weightOn(entries, '2026-10-20')).toBe(80);
    expect(weightOn(entries, '2026-10-10')).toBe(82);
    expect(weightOn(entries, '2026-09-01')).toBe(82);
    expect(weightOn([], '2026-09-01')).toBeNull();
  });
});
