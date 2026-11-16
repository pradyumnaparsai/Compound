import { sameActivityProps, workoutActivityProps } from '@/domain/workoutActivity';
import { ex, set, workout } from '../testutils/workoutFixtures';

const live = (opts = {}) =>
  workout(
    '2026-11-16',
    [ex('bench', [set(60, 8), set(60, 8, { isCompleted: false })]), ex('row', [set(50, 10, { isCompleted: false })])],
    { endedAt: null, title: 'Push day', ...opts },
  );

describe('workoutActivityProps', () => {
  it('is null with no workout or a finished one', () => {
    expect(workoutActivityProps(null)).toBeNull();
    expect(workoutActivityProps(undefined)).toBeNull();
    expect(workoutActivityProps(workout('2026-11-16', []))).toBeNull();
  });

  it('describes a live workout', () => {
    expect(workoutActivityProps(live())).toEqual({
      title: 'Push day',
      startedAt: Date.parse('2026-11-16T10:00:00.000Z'),
      setsDone: 1,
      setsTotal: 3,
    });
  });

  it('falls back for a blank title and an unparsable start', () => {
    jest.useFakeTimers({ now: new Date('2026-11-16T12:00:00.000Z') });
    try {
      const p = workoutActivityProps(live({ title: '  ', startedAt: 'nope' }));
      expect(p?.title).toBe('Workout');
      expect(p?.startedAt).toBe(Date.parse('2026-11-16T12:00:00.000Z'));
    } finally {
      jest.useRealTimers();
    }
  });

  it('copes with a workout with no exercises yet', () => {
    expect(workoutActivityProps(live({ exercises: [] }))).toMatchObject({ setsDone: 0, setsTotal: 0 });
  });
});

describe('sameActivityProps', () => {
  it('compares content, not identity', () => {
    const a = workoutActivityProps(live())!;
    expect(sameActivityProps(a, { ...a })).toBe(true);
    expect(sameActivityProps(a, { ...a, setsDone: 2 })).toBe(false);
    expect(sameActivityProps(a, null)).toBe(false);
    expect(sameActivityProps(null, null)).toBe(true);
  });
});
