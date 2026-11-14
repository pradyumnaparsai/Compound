/** @jest-environment node */
import { MIGRATIONS, migrate } from '@/data/db';
import type { TemplateExercise, WorkoutTemplate } from '@/domain/workout';
import { createNodeDb, type NodeDb } from '../testutils/nodeSqlite';

// Real SQL engine (node:sqlite) behind the expo-sqlite API, so these run the actual migrations and repositories.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => (globalThis as unknown as { __db: unknown }).__db,
}));

const g = globalThis as unknown as { __db: NodeDb };
const version = async (db: NodeDb) =>
  (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version;
const tables = async (db: NodeDb) =>
  (await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);

const WORKOUT_TABLES = ['exercises', 'workout_folders', 'workout_templates', 'template_exercises', 'template_sets', 'workouts', 'workout_exercises', 'workout_sets'];

describe('migrations', () => {
  it('keeps v10 as the workout migration, v11 as the index migration and v12 as the prep migration', () => {
    expect(MIGRATIONS.length).toBe(12);
    expect(MIGRATIONS[9]).toContain('CREATE TABLE workout_sets');
  });

  it('upgrades an existing v9 database and keeps its data', async () => {
    const db = createNodeDb();
    for (let v = 0; v < 9; v++) await db.execAsync(MIGRATIONS[v]);
    await db.execAsync('PRAGMA user_version = 9');
    await db.runAsync("INSERT INTO weights (date, kg, logged_at) VALUES ('2026-01-01', 80.5, 'x')");
    await db.runAsync("INSERT INTO routines (id, title, recurrence, created_at) VALUES ('r1', 'Read', '{\"type\":\"daily\"}', 'x')");
    expect(await tables(db)).not.toContain('workouts');

    await migrate(db as never);

    expect(await version(db)).toBe(12);
    const t = await tables(db);
    for (const name of WORKOUT_TABLES) expect(t).toContain(name);
    expect(await db.getFirstAsync('SELECT kg FROM weights')).toEqual({ kg: 80.5 });
    expect(await db.getFirstAsync('SELECT title FROM routines')).toEqual({ title: 'Read' });

    await migrate(db as never); // idempotent
    expect(await version(db)).toBe(12);
  });

  it('creates everything from scratch', async () => {
    const db = createNodeDb();
    await migrate(db as never);
    expect(await version(db)).toBe(12);
  });

  it('enforces one imported workout per (source, source_id) but allows many local ones', async () => {
    const db = createNodeDb();
    await migrate(db as never);
    const ins = (id: string, source: string | null, sid: string | null) =>
      db.runAsync("INSERT INTO workouts (id, title, started_at, date, source, source_id) VALUES (?, 'w', 'x', '2026-01-01', ?, ?)", id, source, sid);
    await ins('a', 'hevy', '1');
    await expect(ins('b', 'hevy', '1')).rejects.toThrow();
    await ins('c', null, null);
    await ins('d', null, null);
    await ins('e', 'hevy', '2');
  });
});

const tex = (id: string, exerciseId: string, position: number, supersetId: string | null): TemplateExercise => ({
  id,
  exerciseId,
  position,
  supersetId,
  restSeconds: 120,
  notes: 'keep elbows in',
  notesPinned: true,
  sets: [
    { id: `${id}-1`, index: 0, setType: 'warmup', repMin: null, repMax: null, weightKg: 20, reps: 10, durationSeconds: null, distanceMeters: null },
    { id: `${id}-2`, index: 1, setType: 'normal', repMin: 6, repMax: 8, weightKg: 80.25, reps: null, durationSeconds: null, distanceMeters: null },
  ],
});
const template = (id: string, position: number, folderId: string | null = null): WorkoutTemplate => ({
  id,
  title: `Template ${id}`,
  notes: 'n',
  folderId,
  position,
  exercises: [tex(`${id}-a`, 'seed:barbell-bench-press', 0, 'ss'), tex(`${id}-b`, 'seed:overhead-press', 1, 'ss')],
});

describe('workout repositories (real SQLite)', () => {
  beforeEach(() => {
    g.__db = createNodeDb();
    jest.resetModules();
  });

  // Fresh modules per test so each one opens its own in-memory database.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const load = async () => require('@/data/sqliteWorkoutRepository') as typeof import('@/data/sqliteWorkoutRepository');

  it('round-trips a template with exercises, sets, supersets and pinned notes', async () => {
    const { sqliteWorkoutTemplateRepo: repo } = await load();
    const t = template('t1', 0);
    await repo.save(t);
    expect(await repo.list()).toEqual([t]);
  });

  it('save replaces children instead of duplicating them', async () => {
    const { sqliteWorkoutTemplateRepo: repo } = await load();
    await repo.save(template('t1', 0));
    const edited = { ...template('t1', 0), title: 'Renamed', exercises: [tex('t1-a', 'seed:deadlift', 0, null)] };
    await repo.save(edited);
    const [got] = await repo.list();
    expect(got.title).toBe('Renamed');
    expect(got.exercises.map((e) => e.exerciseId)).toEqual(['seed:deadlift']);
    expect((await g.__db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM template_sets'))!.n).toBe(2);
    expect((await g.__db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM template_exercises'))!.n).toBe(1);
  });

  it('remove deletes the template and its children only', async () => {
    const { sqliteWorkoutTemplateRepo: repo } = await load();
    await repo.save(template('t1', 0));
    await repo.save(template('t2', 1));
    await repo.remove('t1');
    expect((await repo.list()).map((t) => t.id)).toEqual(['t2']);
    expect((await g.__db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM template_sets'))!.n).toBe(4);
  });

  it('reorders templates and folders; removing a folder unfiles its templates', async () => {
    const { sqliteWorkoutTemplateRepo: repo, sqliteWorkoutFolderRepo: folders } = await load();
    await folders.add({ id: 'f1', title: 'Push/Pull', position: 0 });
    await folders.add({ id: 'f2', title: 'Legs', position: 1 });
    await repo.save(template('t1', 0, 'f1'));
    await repo.save(template('t2', 1, 'f1'));
    await repo.reorder(['t2', 't1']);
    expect((await repo.list()).map((t) => t.id)).toEqual(['t2', 't1']);
    await folders.reorder(['f2', 'f1']);
    expect((await folders.list()).map((f) => f.id)).toEqual(['f2', 'f1']);
    await folders.remove('f1');
    expect((await folders.list()).map((f) => f.id)).toEqual(['f2']);
    expect((await repo.list()).every((t) => t.folderId === null)).toBe(true);
  });

  it('refuses to delete a custom exercise that is in use', async () => {
    const { sqliteExerciseRepo: repo, sqliteWorkoutTemplateRepo: tpls } = await load();
    const e = { id: 'c1', title: 'Zercher Squat', type: 'weight_reps' as const, primaryMuscle: 'quads' as const, secondaryMuscles: ['glutes' as const], equipment: 'barbell' as const, isCustom: true };
    await repo.add(e);
    expect(await repo.list()).toEqual([e]);
    await tpls.save({ ...template('t1', 0), exercises: [tex('x', 'c1', 0, null)] });
    await expect(repo.remove('c1')).rejects.toThrow(/used/i);
    await tpls.remove('t1');
    await repo.remove('c1');
    expect(await repo.list()).toEqual([]);
  });

  it('settings getValue/setValue round-trips and overwrites', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sqliteSettingsRepo: s } = require('@/data/sqliteRepository') as typeof import('@/data/sqliteRepository');
    expect(await s.getValue('weight_unit')).toBeNull();
    await s.setValue('weight_unit', 'lb');
    await s.setValue('weight_unit', 'kg');
    expect(await s.getValue('weight_unit')).toBe('kg');
  });
});
