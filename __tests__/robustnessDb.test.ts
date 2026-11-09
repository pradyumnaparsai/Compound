/** @jest-environment node */
// Regression tests for the audit fixes that touch SQLite: damaged stored JSON must not break loading, and a failed
// database open must be retried instead of cached forever. Runs on a real SQL engine (node:sqlite).
import { MIGRATIONS, migrate } from '@/data/db';
import { createNodeDb, type NodeDb } from '../testutils/nodeSqlite';

type G = { __db: NodeDb; __failOpens: number };
const g = globalThis as unknown as G;

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => {
    const gg = globalThis as unknown as G;
    if (gg.__failOpens > 0) {
      gg.__failOpens--;
      throw new Error('disk busy');
    }
    return gg.__db;
  },
}));

beforeEach(() => {
  g.__db = createNodeDb();
  g.__failOpens = 0;
  jest.resetModules();
});

describe('damaged stored JSON', () => {
  it('still lists meals when ingredients/assumptions are not valid JSON', async () => {
    await migrate(g.__db as never);
    await g.__db.runAsync(
      "INSERT INTO meals (id, date, logged_at, title, input_type, confidence, ingredients, calories, protein_g, assumptions) VALUES ('m1', '2026-11-01', '2026-11-01T08:00:00.000Z', 'Oats', 'text', 5, 'not json', 300, 10, '{{')",
    );
    await g.__db.runAsync(
      "INSERT INTO meals (id, date, logged_at, title, input_type, confidence, ingredients, calories, protein_g, assumptions) VALUES ('m2', '2026-11-01', '2026-11-01T09:00:00.000Z', 'Egg', 'text', 5, '{\"not\":\"a list\"}', 80, 6, 'null')",
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sqliteMealRepo } = require('@/data/sqliteRepository') as typeof import('@/data/sqliteRepository');
    const meals = await sqliteMealRepo.list();
    expect(meals.map((m) => [m.id, m.ingredients, m.assumptions])).toEqual([
      ['m1', [], []],
      ['m2', [], []],
    ]);
  });

  it('falls back to a daily routine when its recurrence is damaged, and drops bad weekdays', async () => {
    await migrate(g.__db as never);
    const ins = (id: string, rec: string) =>
      g.__db.runAsync('INSERT INTO routines (id, title, recurrence, created_at) VALUES (?, ?, ?, ?)', id, id, rec, '2026-01-01');
    await ins('a', '{oops');
    await ins('b', '{"type":"weekly","days":[1,9,"x",3]}');
    await ins('c', '{"type":"weekly","days":[2,4]}');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sqliteRoutineRepo } = require('@/data/sqliteRepository') as typeof import('@/data/sqliteRepository');
    const list = await sqliteRoutineRepo.list();
    expect(Object.fromEntries(list.map((r) => [r.id, r.recurrence]))).toEqual({
      a: { type: 'daily' },
      b: { type: 'weekly', days: [1, 3] },
      c: { type: 'weekly', days: [2, 4] },
    });
  });
});

describe('food cache', () => {
  it('keeps only the 500 most recently saved products', async () => {
    await migrate(g.__db as never);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sqliteFoodCacheRepo } = require('@/data/sqliteRepository') as typeof import('@/data/sqliteRepository');
    const food = (i: number) => ({ barcode: `b${i}`, name: `Food ${i}`, brand: '', kcal100: 100, protein100: 5, carbs100: 10, fat100: 2, packG: null, servingG: null });
    for (let i = 0; i < 503; i++) await sqliteFoodCacheRepo.put(food(i));
    const rows = await g.__db.getAllAsync<{ barcode: string }>('SELECT barcode FROM food_cache');
    expect(rows).toHaveLength(500);
    expect(await sqliteFoodCacheRepo.get('b502')).not.toBeNull();
  });
});

describe('getDb', () => {
  it('retries after a failed open instead of caching the failure', async () => {
    g.__failOpens = 1;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDb } = require('@/data/db') as typeof import('@/data/db');
    await expect(getDb()).rejects.toThrow('disk busy');
    const db = await getDb();
    expect(db).toBeDefined();
    expect(await getDb()).toBe(db); // and a success is cached
  });
});

describe('v11 indexes', () => {
  it('adds the missing indexes and replaces the narrower meals index', async () => {
    await migrate(g.__db as never);
    const names = (await g.__db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'")).map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['idx_workouts_started', 'idx_template_exercises_exercise', 'idx_meals_date_logged']));
    expect(names).not.toContain('idx_meals_date');
    expect(MIGRATIONS).toHaveLength(11);
  });

  it('upgrades a v10 database without touching its data', async () => {
    for (let v = 0; v < 10; v++) await g.__db.execAsync(MIGRATIONS[v]);
    await g.__db.execAsync('PRAGMA user_version = 10');
    await g.__db.runAsync("INSERT INTO weights (date, kg, logged_at) VALUES ('2026-01-01', 80.5, 'x')");
    await migrate(g.__db as never);
    expect(await g.__db.getFirstAsync('SELECT kg FROM weights')).toEqual({ kg: 80.5 });
  });
});
