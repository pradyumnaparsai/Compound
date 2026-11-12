/** @jest-environment node */
// Regression: checking off one task must persist on that task (real SQL engine, real store).
import { migrate } from '@/data/db';
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
  const { useTaskStore } = require('@/store/useTaskStore') as typeof import('@/store/useTaskStore');
  return useTaskStore;
};

describe('task toggle persistence', () => {
  it('keeps the checked task checked (and the other open) after reload', async () => {
    const store = load();
    await store.getState().add('first', '2026-11-12');
    await store.getState().add('second', '2026-11-12');
    const [first, second] = store.getState().tasks;

    await store.getState().toggle(first.id);
    await store.getState().load(); // simulate next app load

    const byId = new Map(store.getState().tasks.map((t) => [t.id, t]));
    expect(byId.get(first.id)?.completedAt).not.toBeNull();
    expect(byId.get(second.id)?.completedAt).toBeNull();
  });

  it('is correct for tasks created in the same millisecond', async () => {
    const store = load();
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const realIso = Date.prototype.toISOString;
    jest.spyOn(Date.prototype, 'toISOString').mockImplementation(function (this: Date) {
      return isNaN(this.getTime()) ? realIso.call(this) : '2026-11-12T10:00:00.000Z';
    });
    await store.getState().add('first', '2026-11-12');
    await store.getState().add('second', '2026-11-12');
    const [first, second] = store.getState().tasks;
    jest.restoreAllMocks();

    await store.getState().toggle(second.id);
    await store.getState().load();

    const byId = new Map(store.getState().tasks.map((t) => [t.id, t]));
    expect(byId.get(second.id)?.completedAt).not.toBeNull();
    expect(byId.get(first.id)?.completedAt).toBeNull();
  });
});
