import { countsAsStrengthSession, workoutGoalCompletions } from '@/domain/strength';
import type { Routine } from '@/domain/types';
import type { Workout } from '@/domain/workout';
import { ex, set, workout } from '../testutils/workoutFixtures';

const routine = (id: string, over: Partial<Routine> = {}): Routine => ({
  id,
  title: id,
  recurrence: { type: 'daily' },
  goal: { type: 'workout' },
  reminderTime: null,
  createdAt: '2026-01-01',
  archivedAt: null,
  ...over,
});

describe('countsAsStrengthSession', () => {
  const done = (over: Partial<Workout> = {}): Workout => ({ ...workout('2026-11-03', [ex('seed:leg-press', [set(100, 8)])]), ...over });
  it('counts a finished template workout with a logged set', () => {
    expect(countsAsStrengthSession(done({ templateId: 'T1' }))).toBe(true);
  });
  it('ignores workouts without a template', () => {
    expect(countsAsStrengthSession(done({ templateId: null }))).toBe(false);
  });
  it('ignores a template workout with nothing ticked', () => {
    expect(countsAsStrengthSession({ templateId: 'T1', exercises: [ex('a', [set(1, 1, { isCompleted: false })])] })).toBe(false);
    expect(countsAsStrengthSession({ templateId: 'T1', exercises: [] })).toBe(false);
  });
});

describe('workoutGoalCompletions', () => {
  // 2026-11-03 is a Tuesday (weekday 2)
  it('returns the strength-goal routines scheduled that day', () => {
    const rs = [
      routine('daily'),
      routine('tue', { recurrence: { type: 'weekly', days: [2] } }),
      routine('wed', { recurrence: { type: 'weekly', days: [3] } }),
      routine('steps', { goal: { type: 'steps', target: 1000 } }),
      routine('manual', { goal: null }),
      routine('archived', { archivedAt: '2026-11-01' }),
      routine('future', { createdAt: '2026-12-01' }),
    ];
    expect(workoutGoalCompletions(rs, '2026-11-03')).toEqual([
      { routineId: 'daily', date: '2026-11-03' },
      { routineId: 'tue', date: '2026-11-03' },
    ]);
  });
  it('is empty when there are no strength routines', () => {
    expect(workoutGoalCompletions([], '2026-11-03')).toEqual([]);
  });
});
