import type { Food } from '@/domain/food';
import type { Goals, Meal, SavedMeal } from '@/domain/meal';
import type { Completion, Routine, RoutineInput, Task } from '@/domain/types';
import type { WeightEntry } from '@/domain/weight';

export interface RoutineRepository {
  list(): Promise<Routine[]>; // includes archived (history needs them)
  create(input: RoutineInput): Promise<Routine>;
  update(id: string, patch: RoutineInput): Promise<void>;
  archive(id: string): Promise<void>;
  /** Persists the display order; `ids` is the full routine list in the desired order. */
  reorder(ids: string[]): Promise<void>;
}

export interface CompletionRepository {
  list(): Promise<Completion[]>;
  set(routineId: string, date: string, done: boolean): Promise<void>;
}

export interface TaskRepository {
  list(): Promise<Task[]>;
  create(title: string, date: string): Promise<Task>;
  setDone(id: string, done: boolean): Promise<Task['completedAt']>;
  reschedule(id: string, date: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface MealRepository {
  list(): Promise<Meal[]>;
  add(meal: Meal): Promise<void>;
  update(meal: Meal): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface SavedMealRepository {
  list(): Promise<SavedMeal[]>;
  add(m: SavedMeal): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface SettingsRepository {
  getGoals(): Promise<Goals | null>;
  setGoals(g: Goals | null): Promise<void>;
}

export interface FoodCacheRepository {
  get(barcode: string): Promise<Food | null>;
  put(f: Food): Promise<void>;
}

export interface WeightRepository {
  list(): Promise<WeightEntry[]>;
  upsert(date: string, kg: number): Promise<void>;
  remove(date: string): Promise<void>;
}
