/** @jest-environment node */
// Switch-prep checks persist (real SQL engine, real store).
import { MIGRATIONS, migrate } from '@/data/db';
import { itemDone, itemKeys } from '@/domain/prep';
import { PREP_PLAN } from '@/domain/prepPlan';
import { createNodeDb, type NodeDb } from '../testutils/nodeSqlite';

type G = { __db: NodeDb };
const g = globalThis as unknown as G;

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => (globalThis as unknown as G).__db }));

beforeEach(async () => {
  g.__db = createNodeDb();
  await migrate(g.__db as never);
  jest.resetModules();
});

const load = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { usePrepStore } = require('@/store/usePrepStore') as typeof import('@/store/usePrepStore');
  return usePrepStore;
};

const items = PREP_PLAN.find((d) => d.date === '2026-11-15')!.items;
const lld = items.find((i) => i.kind === 'lld')!;
const dsa = items.find((i) => i.kind === 'dsa')!;

describe('v12 migration', () => {
  it('upgrades a v11 database, keeps its data and adds prep_checks', async () => {
    const db = createNodeDb();
    for (let v = 0; v < 11; v++) await db.execAsync(MIGRATIONS[v]);
    await db.execAsync('PRAGMA user_version = 11');
    await db.runAsync("INSERT INTO weights (date, kg, logged_at) VALUES ('2026-01-01', 80.5, 'x')");
    await migrate(db as never);
    expect(await db.getFirstAsync('SELECT kg FROM weights')).toEqual({ kg: 80.5 });
    expect(await db.getAllAsync('SELECT * FROM prep_checks')).toEqual([]);
  });
});

describe('prep store persistence', () => {
  it('keeps a checked single item checked after reload, and its neighbour open', async () => {
    const store = load();
    await store.getState().load();
    await store.getState().toggleItem(dsa);
    await store.getState().load();
    const { checked } = store.getState();
    expect(itemDone(dsa, checked)).toBe(true);
    expect(itemDone(items.filter((i) => i.kind === 'dsa')[1], checked)).toBe(false);
  });

  it('checking a multi-step item ticks every step; tapping again clears them all', async () => {
    const store = load();
    await store.getState().toggleItem(lld);
    await store.getState().load();
    expect(itemKeys(lld).every((k) => store.getState().checked.has(k))).toBe(true);
    expect(itemDone(lld, store.getState().checked)).toBe(true);

    await store.getState().toggleItem(lld);
    await store.getState().load();
    expect(itemKeys(lld).some((k) => store.getState().checked.has(k))).toBe(false);
  });

  it('a single step toggles on its own and leaves the item unfinished', async () => {
    const store = load();
    const [first] = itemKeys(lld);
    await store.getState().toggleStep(first);
    await store.getState().load();
    expect(store.getState().checked.has(first)).toBe(true);
    expect(itemDone(lld, store.getState().checked)).toBe(false);

    await store.getState().toggleStep(first);
    await store.getState().load();
    expect(store.getState().checked.size).toBe(0);
  });

  it('checking twice does not duplicate rows', async () => {
    const store = load();
    await store.getState().toggleStep(itemKeys(lld)[0]);
    await store.getState().toggleItem(lld); // re-ticks the step that was already on
    const rows = await g.__db.getAllAsync<{ key: string }>('SELECT key FROM prep_checks');
    expect(rows).toHaveLength(itemKeys(lld).length);
  });

  it('rolls the optimistic state back when the write fails', async () => {
    const store = load();
    await store.getState().load();
    const spy = jest.spyOn(g.__db, 'runAsync').mockRejectedValueOnce(new Error('disk full'));
    await expect(store.getState().toggleItem(dsa)).rejects.toThrow('disk full');
    expect(itemDone(dsa, store.getState().checked)).toBe(false);
    spy.mockRestore();
  });
});
