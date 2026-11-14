import { create } from 'zustand';
import { sqlitePrepRepo } from '@/data/sqliteRepository';
import type { PrepRepository } from '@/data/repository';
import { toggleTarget } from '@/domain/prep';
import type { PrepItem } from '@/domain/prepPlan';

const prepRepo: PrepRepository = sqlitePrepRepo;

type State = {
  ready: boolean;
  checked: ReadonlySet<string>;
  load: () => Promise<void>;
  /** Checkbox on an item: finishes all its steps, or clears them if it was already finished. */
  toggleItem: (item: PrepItem) => Promise<void>;
  /** Checkbox on one step of a multi-step item. */
  toggleStep: (stepId: string) => Promise<void>;
};

function applied(checked: ReadonlySet<string>, keys: string[], done: boolean): Set<string> {
  const next = new Set(checked);
  for (const k of keys) {
    if (done) next.add(k);
    else next.delete(k);
  }
  return next;
}

export const usePrepStore = create<State>((set, get) => {
  async function write(keys: string[], done: boolean) {
    set({ checked: applied(get().checked, keys, done) }); // optimistic
    try {
      await prepRepo.setMany(keys, done);
    } catch (e) {
      await get().load();
      throw e;
    }
  }

  return {
    ready: false,
    checked: new Set(),

    async load() {
      set({ checked: new Set(await prepRepo.list()), ready: true });
    },

    toggleItem(item) {
      const { keys, done } = toggleTarget(item, get().checked);
      return write(keys, done);
    },

    toggleStep(stepId) {
      return write([stepId], !get().checked.has(stepId));
    },
  };
});
