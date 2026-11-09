import { create } from 'zustand';
import type { WorkoutRepository } from '@/data/repository';
import { sqliteWorkoutRepo } from '@/data/sqliteWorkoutLogRepository';
import type { Workout } from '@/domain/workout';

const repo: WorkoutRepository = sqliteWorkoutRepo;
const PAGE = 30;
let loadingMore = false;

type State = {
  ready: boolean;
  /** Finished workouts, newest first (loaded a page at a time). */
  recent: Workout[];
  hasMore: boolean;
  /** Every local date that has a finished workout (for the calendar). */
  dates: string[];
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useWorkoutHistory = create<State>((set, get) => ({
  ready: false,
  recent: [],
  hasMore: false,
  dates: [],

  async load() {
    // Reload at least as many as are on screen so the list does not jump after an edit.
    const want = Math.max(PAGE, get().recent.length);
    const [recent, dates] = await Promise.all([repo.listRecent(want), repo.datesWithWorkouts()]);
    set({ recent, dates, hasMore: recent.length >= want, ready: true });
  },

  async loadMore() {
    const { recent, hasMore } = get();
    if (!hasMore || recent.length === 0 || loadingMore) return; // onEndReached fires repeatedly
    loadingMore = true;
    try {
      const next = await repo.listRecent(PAGE, recent[recent.length - 1].startedAt);
      // A reload (finish, edit, delete) landed meanwhile: this page is stale, the reload already has the data.
      if (get().recent !== recent) return;
      set({ recent: [...recent, ...next], hasMore: next.length >= PAGE });
    } finally {
      loadingMore = false;
    }
  },

  async remove(id) {
    await repo.remove(id);
    await get().load();
  },
}));
