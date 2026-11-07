import { create } from 'zustand';
import { sqliteTaskRepo } from '@/data/sqliteRepository';
import type { TaskRepository } from '@/data/repository';
import type { Task } from '@/domain/types';

const taskRepo: TaskRepository = sqliteTaskRepo;

type State = {
  ready: boolean;
  tasks: Task[];
  load: () => Promise<void>;
  add: (title: string, date: string) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  reschedule: (id: string, date: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useTaskStore = create<State>((set, get) => ({
  ready: false,
  tasks: [],

  async load() {
    set({ tasks: await taskRepo.list(), ready: true });
  },

  async add(title, date) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const task = await taskRepo.create(trimmed, date);
    set({ tasks: [...get().tasks, task] });
  },

  async toggle(id) {
    const cur = get().tasks.find((t) => t.id === id);
    if (!cur) return;
    const nowDone = !cur.completedAt;
    const stamp = nowDone ? new Date().toISOString() : null;
    set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, completedAt: stamp } : t)) }); // optimistic
    try {
      await taskRepo.setDone(id, nowDone);
    } catch (e) {
      await get().load();
      throw e;
    }
  },

  async reschedule(id, date) {
    set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, date } : t)) });
    try {
      await taskRepo.reschedule(id, date);
    } catch (e) {
      await get().load();
      throw e;
    }
  },

  async remove(id) {
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
    try {
      await taskRepo.remove(id);
    } catch (e) {
      await get().load();
      throw e;
    }
  },
}));
