import type { Workout } from '@/domain/workout';
import { ex, set, workout } from '../testutils/workoutFixtures';

const mockSave = jest.fn();
const mockNudge = jest.fn();
const mockStartLive = jest.fn();
const mockFinishLive = jest.fn();
const mockDiscardLive = jest.fn();
const mockAutoComplete = jest.fn();

jest.mock('@/services/health', () => ({
  saveStrengthWorkout: (...a: unknown[]) => mockSave(...a),
  nudgeWatchStrengthWorkout: (...a: unknown[]) => mockNudge(...a),
  startLiveStrengthSession: (...a: unknown[]) => mockStartLive(...a),
  finishLiveStrengthSession: (...a: unknown[]) => mockFinishLive(...a),
  discardLiveStrengthSession: (...a: unknown[]) => mockDiscardLive(...a),
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

import { onLiveWorkoutDiscarded, onLiveWorkoutFinished, onTemplateWorkoutStarted } from '@/services/workoutHealth';
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
  mockNudge.mockResolvedValue(false);
  mockStartLive.mockResolvedValue(true);
  mockFinishLive.mockResolvedValue(false);
  mockDiscardLive.mockResolvedValue(undefined);
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

  it('does nothing for a workout without a template or with nothing ticked, and stops the live session unsaved', async () => {
    await onLiveWorkoutFinished(finished({ templateId: null }));
    await onLiveWorkoutFinished(finished({ exercises: [] }));
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockFinishLive).not.toHaveBeenCalled();
    expect(mockDiscardLive).toHaveBeenCalledTimes(2);
    expect(mockAutoComplete).not.toHaveBeenCalled();
  });

  it('lets the live session write the workout to Health and does not save a duplicate', async () => {
    mockFinishLive.mockResolvedValueOnce(true);
    await onLiveWorkoutFinished(finished());
    expect((mockFinishLive.mock.calls[0][0] as Date).toISOString()).toBe('2026-11-03T18:45:00.000Z');
    expect(mockSave).not.toHaveBeenCalled();
    expect(useHealthStore.getState().workouts['2026-11-03']).toBe(1);
    expect(mockAutoComplete).toHaveBeenCalledTimes(1);
  });

  it('falls back to writing the workout itself when there was no live session', async () => {
    mockFinishLive.mockResolvedValueOnce(false);
    await onLiveWorkoutFinished(finished());
    expect(mockSave).toHaveBeenCalledTimes(1);
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

describe('onTemplateWorkoutStarted', () => {
  it('starts the live session at the workout start and asks the Watch too, swallowing failures', async () => {
    const at = new Date('2026-11-03T18:00:00.000Z');
    onTemplateWorkoutStarted(at);
    await Promise.resolve();
    expect(mockStartLive).toHaveBeenCalledWith(at);
    expect(mockNudge).toHaveBeenCalledTimes(1);
    mockNudge.mockRejectedValueOnce(new Error('no watch app'));
    mockStartLive.mockRejectedValueOnce(new Error('iOS 25'));
    expect(() => onTemplateWorkoutStarted()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('onLiveWorkoutDiscarded', () => {
  it('ends the live session unsaved and never throws', async () => {
    await onLiveWorkoutDiscarded();
    expect(mockDiscardLive).toHaveBeenCalledTimes(1);
    mockDiscardLive.mockRejectedValueOnce(new Error('boom'));
    await expect(onLiveWorkoutDiscarded()).resolves.toBeUndefined();
  });
});
