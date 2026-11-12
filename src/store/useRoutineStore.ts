import { create } from 'zustand';
import { sqliteCompletionRepo, sqliteRoutineRepo } from '@/data/sqliteRepository';
import type { CompletionRepository, RoutineRepository } from '@/data/repository';
import { completionKey, toDoneSet } from '@/domain/recurrence';
import type { Routine, RoutineInput } from '@/domain/types';

// Swap these two to change the storage backend (e.g. cloud sync later).
const routineRepo: RoutineRepository = sqliteRoutineRepo;
const completionRepo: CompletionRepository = sqliteCompletionRepo;

type State = {
  ready: boolean;
  routines: Routine[];
  done: Set<string>; // `${routineId}|${date}`
  load: () => Promise<void>;
  addRoutine: (input: RoutineInput) => Promise<void>;
  updateRoutine: (id: string, input: RoutineInput) => Promise<void>;
  archiveRoutine: (id: string) => Promise<void>;
  /** `visibleIds` = a subset of routines (e.g. today's) in their new order; others keep their slots. */
  reorder: (visibleIds: string[]) => Promise<void>;
  toggle: (routineId: string, date: string) => Promise<void>;
  /** Marks health-goal completions done. Only ever adds; never removes. */
  autoComplete: (items: { routineId: string; date: string }[]) => Promise<void>;
};

export const useRoutineStore = create<State>((set, get) => ({
  ready: false,
  routines: [],
  done: new Set(),

  async load() {
    const [routines, completions] = await Promise.all([routineRepo.list(), completionRepo.list()]);
    set({ routines, done: toDoneSet(completions), ready: true });
  },

  async addRoutine(input) {
    const r = await routineRepo.create(input);
    set({ routines: [...get().routines, r] });
  },

  async updateRoutine(id, input) {
    await routineRepo.update(id, input);
    set({
      routines: get().routines.map((r) =>
        r.id === id
          ? { ...r, title: input.title.trim(), recurrence: input.recurrence, goal: input.goal ?? null }
          : r,
      ),
    });
  },

  async archiveRoutine(id) {
    await routineRepo.archive(id);
    await get().load();
  },

  async reorder(visibleIds) {
    const all = get().routines;
    const byId = new Map(all.map((r) => [r.id, r]));
    const ids = visibleIds.filter((id) => byId.has(id));
    const idSet = new Set(ids);
    const next = [...all];
    let k = 0;
    all.forEach((r, i) => {
      if (idSet.has(r.id)) next[i] = byId.get(ids[k++])!;
    });
    set({ routines: next }); // optimistic
    try {
      await routineRepo.reorder(next.map((r) => r.id));
    } catch (e) {
      await get().load();
      throw e;
    }
  },

  async autoComplete(items) {
    const fresh = items.filter((i) => !get().done.has(completionKey(i.routineId, i.date)));
    if (fresh.length === 0) return;
    const next = new Set(get().done);
    for (const i of fresh) next.add(completionKey(i.routineId, i.date));
    set({ done: next });
    try {
      await Promise.all(fresh.map((i) => completionRepo.set(i.routineId, i.date, true)));
    } catch (e) {
      await get().load();
      throw e;
    }
  },

  async toggle(routineId, date) {
    // Health-goal routines are completed by Apple Health data, not by hand.
    if (get().routines.find((r) => r.id === routineId)?.goal) return;
    const key = completionKey(routineId, date);
    const next = new Set(get().done);
    const nowDone = !next.has(key);
    if (nowDone) next.add(key);
    else next.delete(key);
    set({ done: next }); // optimistic
    try {
      await completionRepo.set(routineId, date, nowDone);
    } catch (e) {
      await get().load(); // resync on failure
      throw e;
    }
  },
}));
