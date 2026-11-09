// Regression tests for store-level bugs found in the audit (mocked repositories, real stores and domain logic).
import type { Meal } from '../src/domain/meal';
import type { Workout } from '../src/domain/workout';
import { ex, set, workout } from '../testutils/workoutFixtures';

jest.mock('@/data/sqliteWorkoutLogRepository', () => ({
  sqliteWorkoutRepo: {
    getActive: jest.fn(),
    save: jest.fn(),
    get: jest.fn(),
    listRecent: jest.fn(),
    listForExercises: jest.fn(),
    listByDate: jest.fn(),
    datesWithWorkouts: jest.fn(),
    remove: jest.fn(),
  },
}));
jest.mock('@/store/useRestTimer', () => ({ useRestTimer: { getState: () => ({ start: jest.fn(), stop: jest.fn() }) } }));
jest.mock('@/data/sqliteRepository', () => {
  const empty = { list: jest.fn(async () => []) };
  return {
    sqliteMealRepo: { list: jest.fn(), add: jest.fn(), update: jest.fn(), remove: jest.fn() },
    sqliteSavedMealRepo: empty,
    sqliteMealScheduleRepo: empty,
    sqliteSettingsRepo: { getGoals: jest.fn(async () => null) },
  };
});

/* eslint-disable import/first */
import { sqliteMealRepo } from '@/data/sqliteRepository';
import { sqliteWorkoutRepo } from '@/data/sqliteWorkoutLogRepository';
import { useMealStore } from '@/store/useMealStore';
import { useWorkoutHistory } from '@/store/useWorkoutHistory';
import { useWorkoutSession } from '@/store/useWorkoutSession';

const mockLogRepo = sqliteWorkoutRepo as unknown as Record<keyof typeof sqliteWorkoutRepo, jest.Mock>;
const mockMealRepo = sqliteMealRepo as unknown as Record<keyof typeof sqliteMealRepo, jest.Mock>;

const finished = (date: string): Workout => ({ ...workout(date, [ex('a', [set(50, 5)])]), id: `w-${date}`, startedAt: `${date}T10:00:00.000Z` });
const tick = () => new Promise<void>((r) => setImmediate(() => r()));

beforeEach(() => {
  jest.clearAllMocks();
  mockLogRepo.save.mockResolvedValue(undefined);
  mockLogRepo.remove.mockResolvedValue(undefined);
  mockLogRepo.listForExercises.mockResolvedValue([]);
  mockLogRepo.datesWithWorkouts.mockResolvedValue([]);
  useWorkoutSession.setState({ workout: null, mode: null, baseline: null, histories: {} });
  useWorkoutHistory.setState({ ready: false, recent: [], hasMore: false, dates: [] });
});

describe('workout history paging', () => {
  it('does not append the same page twice when onEndReached fires repeatedly', async () => {
    const first = Array.from({ length: 30 }, (_, i) => finished(`2026-10-${String(30 - i).padStart(2, '0')}`));
    useWorkoutHistory.setState({ recent: first, hasMore: true, ready: true });
    let resolve!: (w: Workout[]) => void;
    mockLogRepo.listRecent.mockReturnValue(new Promise<Workout[]>((r) => (resolve = r)));

    const a = useWorkoutHistory.getState().loadMore();
    const b = useWorkoutHistory.getState().loadMore(); // second call while the first is still in flight
    resolve([finished('2026-09-01')]);
    await Promise.all([a, b]);

    expect(mockLogRepo.listRecent).toHaveBeenCalledTimes(1);
    const ids = useWorkoutHistory.getState().recent.map((w) => w.id);
    expect(ids).toHaveLength(31);
    expect(new Set(ids).size).toBe(31);
  });

  it('drops a page that was fetched before a reload replaced the list', async () => {
    const first = Array.from({ length: 30 }, (_, i) => finished(`2026-10-${String(30 - i).padStart(2, '0')}`));
    useWorkoutHistory.setState({ recent: first, hasMore: true, ready: true });
    let resolve!: (w: Workout[]) => void;
    mockLogRepo.listRecent.mockReturnValueOnce(new Promise<Workout[]>((r) => (resolve = r)));
    const pending = useWorkoutHistory.getState().loadMore();

    mockLogRepo.listRecent.mockResolvedValueOnce(first.slice(1)); // a delete + reload landed meanwhile
    await useWorkoutHistory.getState().load();
    resolve([finished('2026-09-01')]);
    await pending;

    expect(useWorkoutHistory.getState().recent).toHaveLength(29);
  });

  it('can load more again after a page finished', async () => {
    const first = Array.from({ length: 30 }, (_, i) => finished(`2026-10-${String(30 - i).padStart(2, '0')}`));
    useWorkoutHistory.setState({ recent: first, hasMore: true, ready: true });
    mockLogRepo.listRecent.mockResolvedValueOnce([finished('2026-09-02')]).mockResolvedValueOnce([finished('2026-09-01')]);
    await useWorkoutHistory.getState().loadMore();
    useWorkoutHistory.setState({ hasMore: true });
    await useWorkoutHistory.getState().loadMore();
    expect(useWorkoutHistory.getState().recent).toHaveLength(32);
  });
});

describe('workout session', () => {
  it('an edit left open without changes no longer blocks starting a new workout', async () => {
    mockLogRepo.get.mockResolvedValue(finished('2026-11-01'));
    await useWorkoutSession.getState().beginEdit('w-2026-11-01');
    expect(useWorkoutSession.getState().mode).toBe('edit');

    await useWorkoutSession.getState().startFromTemplate(null);

    expect(useWorkoutSession.getState().mode).toBe('live');
    expect(useWorkoutSession.getState().workout?.id).not.toBe('w-2026-11-01');
  });

  it('still refuses to start over a live workout', async () => {
    await useWorkoutSession.getState().startFromTemplate(null);
    await expect(useWorkoutSession.getState().startFromTemplate(null)).rejects.toThrow(/in progress/);
  });

  it('a pending autosave cannot resurrect a workout while it is being finished', async () => {
    jest.useFakeTimers();
    try {
      await useWorkoutSession.getState().startFromTemplate(null);
      useWorkoutSession.getState().setTitle('Leg day'); // schedules the 350 ms autosave
      mockLogRepo.save.mockClear();

      let release!: () => void;
      mockLogRepo.save.mockReturnValueOnce(new Promise<void>((r) => (release = r)));
      const finishing = useWorkoutSession.getState().finish();
      await jest.advanceTimersByTimeAsync(1000); // the autosave timer would fire here
      release();
      await finishing;
      await jest.advanceTimersByTimeAsync(1000);

      const saved = mockLogRepo.save.mock.calls.map(([w]) => w as Workout);
      expect(saved).toHaveLength(1);
      expect(saved[0].endedAt).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('a pending autosave cannot re-create a workout that is being discarded', async () => {
    jest.useFakeTimers();
    try {
      await useWorkoutSession.getState().startFromTemplate(null);
      useWorkoutSession.getState().setTitle('Oops');
      mockLogRepo.save.mockClear();
      let release!: () => void;
      mockLogRepo.remove.mockReturnValueOnce(new Promise<void>((r) => (release = r)));
      const discarding = useWorkoutSession.getState().discard();
      await jest.advanceTimersByTimeAsync(1000);
      release();
      await discarding;
      expect(mockLogRepo.save).not.toHaveBeenCalled();
      expect(useWorkoutSession.getState().workout).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('meal store ordering', () => {
  const meal = (id: string, date: string, loggedAt: string): Meal => ({
    id,
    date,
    slot: 'lunch',
    loggedAt,
    title: id,
    inputType: 'image_and_note',
    confidence: 5,
    ingredients: [],
    calories: 100,
    proteinG: 1,
    carbsG: 1,
    fatG: 1,
    assumptions: [],
  });

  it('keeps meals ascending by date then time when a backdated meal is added', async () => {
    mockMealRepo.add.mockResolvedValue(undefined);
    useMealStore.setState({ meals: [meal('a', '2026-11-08', '2026-11-08T08:00:00.000Z'), meal('c', '2026-11-08', '2026-11-08T19:00:00.000Z')] });
    await useMealStore.getState().add(meal('old', '2026-11-05', '2026-11-08T12:00:00.000Z'));
    await useMealStore.getState().add(meal('b', '2026-11-08', '2026-11-08T13:00:00.000Z'));
    expect(useMealStore.getState().meals.map((m) => m.id)).toEqual(['old', 'a', 'b', 'c']);
    await tick();
  });
});
