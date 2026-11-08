/** @jest-environment node */
import { migrate } from '@/data/db';
import { createNodeDb, type NodeDb } from '../testutils/nodeSqlite';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => (globalThis as unknown as { __db: unknown }).__db,
}));

const g = globalThis as unknown as { __db: NodeDb };

const HEADER = '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"';
const r = (title: string, start: string, ex: string, i: number, kg: string, reps: string, notes = '') =>
  `"${title}","${start}","${start.replace(/\d\d:\d\d$/, '23:59')}","","${ex}",,"${notes}",${i},"normal",${kg},${reps},,,`;
const CSV = [
  HEADER,
  r('Upper 1', '3 Nov 2026, 18:58', 'Bench Press (Barbell)', 0, '25', '7', 'IDR'),
  r('Upper 1', '3 Nov 2026, 18:58', 'Bench Press (Barbell)', 1, '25', '6', 'IDR'),
  r('Upper 1', '3 Nov 2026, 18:58', 'Incline Chest Press (Machine)', 0, '89', '11'),
  r('Upper 1', '2 Nov 2026, 18:00', 'Bench Press (Barbell)', 0, '20', '8'),
].join('\n');

describe('Hevy import into SQLite', () => {
  beforeEach(async () => {
    g.__db = createNodeDb();
    await migrate(g.__db as never);
    jest.resetModules();
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const importer = () => (require('@/data/sqliteHevyImport') as typeof import('@/data/sqliteHevyImport')).importHevyCsv;
  const count = async (table: string) => (await g.__db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM ${table}`))!.c;

  it('writes exercises, a template and finished workouts that the repositories can read back', async () => {
    const res = await importer()(CSV);
    expect(res).toEqual({ workouts: 2, alreadyThere: 0, templates: 1, exercises: 1, skippedRows: 0 });
    expect(await count('workout_sets')).toBe(4);
    expect(await count('template_sets')).toBe(3);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const logRepo = (require('@/data/sqliteWorkoutLogRepository') as typeof import('@/data/sqliteWorkoutLogRepository')).sqliteWorkoutRepo;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lib = require('@/data/sqliteWorkoutRepository') as typeof import('@/data/sqliteWorkoutRepository');
    const [tpl] = await lib.sqliteWorkoutTemplateRepo.list();
    expect(tpl.title).toBe('Upper 1');
    expect(tpl.exercises.map((e) => e.exerciseId)).toEqual(['seed:barbell-bench-press', 'hevy:incline-chest-press-machine']);

    const recent = await logRepo.listRecent(10);
    expect(recent.map((w) => w.date)).toEqual(['2026-11-03', '2026-11-02']);
    expect(recent[0].templateId).toBe(tpl.id);
    expect(recent[0].exercises[0].notes).toBe('IDR');
    expect(recent[0].exercises[0].sets.map((s) => [s.weightKg, s.reps, s.isCompleted])).toEqual([[25, 7, true], [25, 6, true]]);
    expect(await logRepo.getActive()).toBeNull(); // nothing is left "in progress"
    expect((await lib.sqliteExerciseRepo.list()).map((e) => e.id)).toEqual(['hevy:incline-chest-press-machine']);
  });

  it('is safe to run twice: nothing is added again', async () => {
    await importer()(CSV);
    const again = await importer()(CSV);
    expect(again).toMatchObject({ workouts: 0, alreadyThere: 2, templates: 0, exercises: 0 });
    expect(await count('workouts')).toBe(2);
    expect(await count('workout_templates')).toBe(1);
    expect(await count('workout_sets')).toBe(4);
  });

  it('picks up only new workouts from a later export', async () => {
    await importer()(CSV);
    const later = `${CSV}\n${r('Upper 1', '9 Nov 2026, 18:00', 'Bench Press (Barbell)', 0, '27.5', '5')}`;
    const res = await importer()(later);
    expect(res).toMatchObject({ workouts: 1, alreadyThere: 2, templates: 0 });
    expect(await count('workouts')).toBe(3);
  });

  it('puts new templates after the ones you already have', async () => {
    await g.__db.runAsync("INSERT INTO workout_templates (id, title, notes, folder_id, position, created_at) VALUES ('mine', 'Mine', '', NULL, 4, 'x')");
    await importer()(CSV);
    expect((await g.__db.getFirstAsync<{ position: number }>("SELECT position FROM workout_templates WHERE title = 'Upper 1'"))!.position).toBe(5);
  });

  it('rolls back everything when a file is not a Hevy export', async () => {
    await expect(importer()('a,b\n1,2')).rejects.toThrow(/Hevy/);
    expect(await count('workouts')).toBe(0);
  });
});
