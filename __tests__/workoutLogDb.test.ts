/** @jest-environment node */
import { migrate } from '@/data/db';
import { ex, set, workout } from '../testutils/workoutFixtures';
import { createNodeDb, type NodeDb } from '../testutils/nodeSqlite';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => (globalThis as unknown as { __db: unknown }).__db,
}));

const g = globalThis as unknown as { __db: NodeDb };

describe('workout log repository (real SQLite)', () => {
  beforeEach(async () => {
    g.__db = createNodeDb();
    await migrate(g.__db as never);
    jest.resetModules();
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const repo = () => (require('@/data/sqliteWorkoutLogRepository') as typeof import('@/data/sqliteWorkoutLogRepository')).sqliteWorkoutRepo;

  const full = () =>
    workout('2026-11-01', [
      ex('seed:barbell-bench-press', [set(80.25, 8, { rpe: 8.5, completedAt: '2026-11-01T10:05:00.000Z' }), set(20, 10, { type: 'warmup' })], { supersetId: 'ss', notes: 'elbows', notesPinned: true }),
      ex('seed:overhead-press', [set(40, 6)], { supersetId: 'ss' }),
    ], { templateId: 'T1', notes: 'felt good' });

  it('round-trips a finished workout exactly', async () => {
    const w = full();
    await repo().save(w);
    expect(await repo().get(w.id)).toEqual(w);
  });

  it('save replaces children, not duplicates them', async () => {
    const w = full();
    await repo().save(w);
    const edited = { ...w, exercises: [{ ...w.exercises[0], sets: w.exercises[0].sets.slice(0, 1) }] };
    await repo().save(edited);
    expect(await repo().get(w.id)).toEqual(edited);
    expect((await g.__db.getFirstAsync<{ c: number }>('SELECT COUNT(*) c FROM workout_sets'))!.c).toBe(1);
  });

  it('getActive returns only the unfinished workout and listRecent skips it', async () => {
    const live = { ...workout('2026-11-02', [ex('a', [set(1, 1, { isCompleted: false })])]), endedAt: null };
    const done = full();
    await repo().save(live);
    await repo().save(done);
    expect((await repo().getActive())?.id).toBe(live.id);
    expect((await repo().listRecent(10)).map((w) => w.id)).toEqual([done.id]);
    await repo().save({ ...live, endedAt: '2026-11-02T11:00:00.000Z' });
    expect(await repo().getActive()).toBeNull();
  });

  it('lists newest first with a cursor', async () => {
    const ws = ['2026-10-01', '2026-10-02', '2026-10-03'].map((d) => workout(d, [ex('a', [set(1, 1)])]));
    for (const w of ws) await repo().save(w);
    const first = await repo().listRecent(2);
    expect(first.map((w) => w.date)).toEqual(['2026-10-03', '2026-10-02']);
    const next = await repo().listRecent(2, first[1].startedAt);
    expect(next.map((w) => w.date)).toEqual(['2026-10-01']);
  });

  it('filters by exercise keeping only those exercises, and by date', async () => {
    const w = full();
    await repo().save(w);
    const hit = await repo().listForExercises(['seed:overhead-press']);
    expect(hit).toHaveLength(1);
    expect(hit[0].exercises.map((e) => e.exerciseId)).toEqual(['seed:overhead-press']);
    expect(await repo().listForExercises(['nope'])).toEqual([]);
    expect(await repo().listForExercises([])).toEqual([]);
    expect((await repo().listByDate('2026-11-01')).map((x) => x.id)).toEqual([w.id]);
    expect(await repo().listByDate('2026-11-09')).toEqual([]);
    expect(await repo().datesWithWorkouts()).toEqual(['2026-11-01']);
  });

  it('remove deletes exercises and sets too', async () => {
    const w = full();
    await repo().save(w);
    await repo().remove(w.id);
    expect(await repo().get(w.id)).toBeNull();
    for (const t of ['workout_exercises', 'workout_sets'])
      expect((await g.__db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM ${t}`))!.c).toBe(0);
  });
});
