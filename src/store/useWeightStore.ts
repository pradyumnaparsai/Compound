import { create } from 'zustand';
import type { WeightRepository } from '@/data/repository';
import { sqliteWeightRepo } from '@/data/sqliteRepository';
import type { WeightEntry } from '@/domain/weight';

const repo: WeightRepository = sqliteWeightRepo;

type State = {
  entries: WeightEntry[]; // ascending by date
  load: () => Promise<void>;
  log: (date: string, kg: number) => Promise<void>;
  remove: (date: string) => Promise<void>;
};

export const useWeightStore = create<State>((set, get) => ({
  entries: [],
  async load() {
    set({ entries: await repo.list() });
  },
  async log(date, kg) {
    await repo.upsert(date, kg);
    const rest = get().entries.filter((e) => e.date !== date);
    set({ entries: [...rest, { date, kg }].sort((a, b) => a.date.localeCompare(b.date)) });
  },
  async remove(date) {
    await repo.remove(date);
    set({ entries: get().entries.filter((e) => e.date !== date) });
  },
}));
