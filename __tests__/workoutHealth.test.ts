import type { Workout } from '@/domain/workout';
import { ex, set, workout } from '../testutils/workoutFixtures';

const mockSave = jest.fn();
const mockAutoComplete = jest.fn();

jest.mock('@/services/health', () => ({
  saveStrengthWorkout: (...a: unknown[]) => mockSave(...a),
}));
jest.mock('@/store/useRoutineStore', () => ({
  useRoutineStore: {
    getState: () => ({
      autoComplete: mockAutoComplete,
      routines: [
        { id: 'lift', title: 'Lift', recurrence: { type: 'daily' }, goal: { type: 'workout' }, reminderTime: null, createdAt: '2026-01-01', archivedAt: null },
        { id: 'read', title: 'Read', recurrence: { type: 'daily' }, goal: null, reminderTime: null, createdAt: '2026-01-01', archivedAt: null },
      ],
    }),
  },
}));

import { onLiveWorkoutFinished } from '@/services/workoutHealth';
import { useHealthStore } from '@/store/useHealthStore';

const finished = (over: Partial<Workout> = {}): Workout => ({
  ...workout('2026-11-03', [ex('seed:leg-press', [set(100, 8)])]),
  templateId: 'T1',
  startedAt: '2026-11-03T18:00:00.000Z',
  endedAt: '2026-11-03T18:45:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue(true);
  mockAutoComplete.mockResolvedValue(undefined);
  useHealthStore.setState({ workouts: {}, steps: {}, checked: false });
});

describe('onLiveWorkoutFinished', () => {
  it('saves the real start and end to Health and ticks the strength routine for the workout day', async () => {
    await onLiveWorkoutFinished(finished());
    const [start, end] = mockSave.mock.calls[0] as [Date, Date];
    expect(start.toISOString()).toBe('2026-11-03T18:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-03T18:45:00.000Z');
    expect(mockAutoComplete).toHaveBeenCalledWith([{ routineId: 'lift', date: '2026-11-03' }]);
    expect(useHealthStore.getState().workouts['2026-11-03']).toBe(1);
  });

  it('does nothing for a workout without a template or with nothing ticked', async () => {
    await onLiveWorkoutFinished(finished({ templateId: null }));
    await onLiveWorkoutFinished(finished({ exercises: [] }));
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockAutoComplete).not.toHaveBeenCalled();
  });

  it('still ticks the routine when Health refuses or throws, and never throws itself', async () => {
    mockSave.mockResolvedValueOnce(false);
    await onLiveWorkoutFinished(finished());
    expect(mockAutoComplete).toHaveBeenCalledTimes(1);
    expect(useHealthStore.getState().workouts['2026-11-03']).toBeUndefined();

    mockSave.mockRejectedValueOnce(new Error('boom'));
    await expect(onLiveWorkoutFinished(finished())).resolves.toBeUndefined();
    expect(mockAutoComplete).toHaveBeenCalledTimes(2);
  });

  it('survives a failing routine write', async () => {
    mockAutoComplete.mockRejectedValueOnce(new Error('disk'));
    await expect(onLiveWorkoutFinished(finished())).resolves.toBeUndefined();
  });

  it('needs an end time', async () => {
    await onLiveWorkoutFinished(finished({ endedAt: null }));
    expect(mockSave).not.toHaveBeenCalled();
  });
});
