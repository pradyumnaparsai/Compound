import { create } from 'zustand';
import type { MealRepository, MealScheduleRepository, SavedMealRepository, SettingsRepository } from '@/data/repository';
import { sqliteMealRepo, sqliteMealScheduleRepo, sqliteSavedMealRepo, sqliteSettingsRepo } from '@/data/sqliteRepository';
import type { Goals, Meal, SavedMeal } from '@/domain/meal';
import type { MealSchedule } from '@/domain/mealSchedule';

const repo: MealRepository = sqliteMealRepo;
const savedRepo: SavedMealRepository = sqliteSavedMealRepo;
const settings: SettingsRepository = sqliteSettingsRepo;
const scheduleRepo: MealScheduleRepository = sqliteMealScheduleRepo;

const byTitle = (a: SavedMeal, b: SavedMeal) => a.title.localeCompare(b.title);

type State = {
  meals: Meal[]; // ascending by date, then logged time
  saved: SavedMeal[]; // by title
  schedules: MealSchedule[];
  goals: Goals | null;
  load: () => Promise<void>;
  add: (meal: Meal) => Promise<void>;
  update: (meal: Meal) => Promise<void>;
  remove: (id: string) => Promise<void>;
  saveTemplate: (m: SavedMeal) => Promise<void>;
  updateTemplate: (m: SavedMeal) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  addSchedule: (s: MealSchedule) => Promise<void>;
  updateSchedule: (s: MealSchedule) => Promise<void>;
  removeSchedule: (id: string) => Promise<void>;
  setGoals: (g: Goals | null) => Promise<void>;
};

export const useMealStore = create<State>((set, get) => ({
  meals: [],
  saved: [],
  schedules: [],
  goals: null,
  async load() {
    const [meals, saved, schedules, goals] = await Promise.all([
      repo.list(),
      savedRepo.list(),
      scheduleRepo.list(),
      settings.getGoals(),
    ]);
    set({ meals, saved, schedules, goals });
  },
  async add(meal) {
    await repo.add(meal);
    set({ meals: [...get().meals, meal] });
  },
  async update(meal) {
    await repo.update(meal);
    set({ meals: get().meals.map((m) => (m.id === meal.id ? meal : m)) });
  },
  async remove(id) {
    await repo.remove(id);
    set({ meals: get().meals.filter((m) => m.id !== id) });
  },
  async saveTemplate(m) {
    await savedRepo.add(m);
    set({ saved: [...get().saved, m].sort(byTitle) });
  },
  async updateTemplate(m) {
    await savedRepo.update(m);
    set({ saved: get().saved.map((x) => (x.id === m.id ? m : x)).sort(byTitle) });
  },
  async removeTemplate(id) {
    await savedRepo.remove(id); // also deletes its schedules
    set({ saved: get().saved.filter((m) => m.id !== id), schedules: get().schedules.filter((s) => s.savedMealId !== id) });
  },
  async addSchedule(s) {
    await scheduleRepo.add(s);
    set({ schedules: [...get().schedules, s] });
  },
  async updateSchedule(s) {
    await scheduleRepo.update(s);
    // Keep lastApplied from memory: the service updates it directly in the DB.
    set({ schedules: get().schedules.map((x) => (x.id === s.id ? { ...s, lastApplied: x.lastApplied } : x)) });
  },
  async removeSchedule(id) {
    await scheduleRepo.remove(id);
    set({ schedules: get().schedules.filter((s) => s.id !== id) });
  },
  async setGoals(g) {
    await settings.setGoals(g);
    set({ goals: g });
  },
}));
