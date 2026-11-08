import { summarize } from '@/domain/summary';
import { ex, set, workout } from '../testutils/workoutFixtures';

const typeOf = () => 'weight_reps' as const;

describe('summarize', () => {
  const past = workout('2026-10-01', [ex('bench', [set(80, 8)])]);
  const today = workout('2026-10-08', [
    ex('bench', [set(20, 10, { type: 'warmup' }), set(85, 5), set(60, 5, { isCompleted: false })]),
    ex('row', [set(50, 10, { isCompleted: false })]),
  ]);

  it('totals count completed sets only and exclude warm-ups by default', () => {
    const s = summarize(today, [past], typeOf);
    expect(s.volumeKg).toBe(425);
    expect(s.setCount).toBe(1);
    expect(s.exerciseCount).toBe(1);
    expect(s.durationSeconds).toBe(3600);
    expect(summarize(today, [past], typeOf, { includeWarmup: true })).toMatchObject({ volumeKg: 625, setCount: 2 });
  });

  it('finds PRs against earlier workouts, never against itself or later ones', () => {
    const later = workout('2026-10-20', [ex('bench', [set(120, 5)])]);
    const s = summarize(today, [past, today, later], typeOf);
    expect(s.prs.some((p) => p.kind === 'weight' && p.value === 85)).toBe(true);
    expect(s.prs.every((p) => p.exerciseId === 'bench')).toBe(true);
  });

  it('has no PRs on the first ever workout', () => {
    expect(summarize(past, [], typeOf).prs).toEqual([]);
  });
});
