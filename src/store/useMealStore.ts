import { create } from 'zustand';
import type { MealRepository, SavedMealRepository, SettingsRepository } from '@/data/repository';
import { sqliteMealRepo, sqliteSavedMealRepo, sqliteSettingsRepo } from '@/data/sqliteRepository';
import type { Goals, Meal, SavedMeal } from '@/domain/meal';

const repo: MealRepository = sqliteMealRepo;
const savedRepo: SavedMealRepository = sqliteSavedMealRepo;
const settings: SettingsRepository = sqliteSettingsRepo;

type State = {
  meals: Meal[]; // ascending by date, then logged time
  saved: SavedMeal[]; // by title
  goals: Goals | null;
  load: () => Promise<void>;
  add: (meal: Meal) => Promise<void>;
  update: (meal: Meal) => Promise<void>;
  remove: (id: string) => Promise<void>;
  saveTemplate: (m: SavedMeal) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  setGoals: (g: Goals | null) => Promise<void>;
};

export const useMealStore = create<State>((set, get) => ({
  meals: [],
  saved: [],
  goals: null,
  async load() {
    const [meals, saved, goals] = await Promise.all([repo.list(), savedRepo.list(), settings.getGoals()]);
    set({ meals, saved, goals });
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
    set({ saved: [...get().saved, m].sort((a, b) => a.title.localeCompare(b.title)) });
  },
  async removeTemplate(id) {
    await savedRepo.remove(id);
    set({ saved: get().saved.filter((m) => m.id !== id) });
  },
  async setGoals(g) {
    await settings.setGoals(g);
    set({ goals: g });
  },
}));
