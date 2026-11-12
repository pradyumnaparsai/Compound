import type { Food } from '@/domain/food';
import type { Goals, Meal, SavedMeal } from '@/domain/meal';
import type { MealSchedule } from '@/domain/mealSchedule';
import type { Completion, Routine, RoutineInput, Task } from '@/domain/types';
import type { WeightEntry } from '@/domain/weight';
import type { ExerciseDef, Workout, WorkoutFolder, WorkoutTemplate } from '@/domain/workout';

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
  update(m: SavedMeal): Promise<void>;
  /** Also deletes the meal's schedules. */
  remove(id: string): Promise<void>;
}

export interface MealScheduleRepository {
  list(): Promise<MealSchedule[]>;
  add(s: MealSchedule): Promise<void>;
  update(s: MealSchedule): Promise<void>;
  remove(id: string): Promise<void>;
  /** Atomically marks the schedule applied for `date`. False if it already was (another run won the race). */
  claim(id: string, date: string): Promise<boolean>;
  /** Undoes a claim after the meal could not be logged. */
  release(id: string, previous: string | null): Promise<void>;
}

export interface SettingsRepository {
  getGoals(): Promise<Goals | null>;
  setGoals(g: Goals | null): Promise<void>;
  /** One-time markers (e.g. 'a default row was already created'); stored in the settings table. */
  getFlag(key: string): Promise<boolean>;
  setFlag(key: string): Promise<void>;
  /** Plain string settings (weight unit, plate setup, ...). Part of the cloud backup. */
  getValue(key: string): Promise<string | null>;
  setValue(key: string, value: string): Promise<void>;
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

/** Custom and imported exercises only; the built-in catalog lives in code. */
export interface ExerciseRepository {
  list(): Promise<ExerciseDef[]>;
  add(e: ExerciseDef): Promise<void>;
  update(e: ExerciseDef): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface WorkoutFolderRepository {
  list(): Promise<WorkoutFolder[]>;
  add(f: WorkoutFolder): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  /** Templates inside the folder move out of it (they are not deleted). */
  remove(id: string): Promise<void>;
  /** Persists the display order; `ids` is the full folder list in the desired order. */
  reorder(ids: string[]): Promise<void>;
}

export interface WorkoutTemplateRepository {
  list(): Promise<WorkoutTemplate[]>;
  /** Inserts or replaces the whole template (exercises and sets) in one transaction. */
  save(t: WorkoutTemplate): Promise<void>;
  /** Also deletes its exercises and sets. */
  remove(id: string): Promise<void>;
  /** Persists the display order; `ids` is the full template list in the desired order. */
  reorder(ids: string[]): Promise<void>;
}

export interface WorkoutRepository {
  /** The workout being logged right now (no end time), if any. */
  getActive(): Promise<Workout | null>;
  /** Inserts or replaces the whole workout (exercises and sets) in one transaction. */
  save(w: Workout): Promise<void>;
  get(id: string): Promise<Workout | null>;
  /** Finished workouts, newest first; `before` is a `startedAt` cursor for the next page. */
  listRecent(limit: number, before?: string): Promise<Workout[]>;
  /** Finished workouts that include any of the exercises, with only those exercises (and their sets) kept. */
  listForExercises(exerciseIds: string[]): Promise<Workout[]>;
  /** Finished workouts started on a local date (YYYY-MM-DD), oldest first. */
  listByDate(date: string): Promise<Workout[]>;
  /** Local dates (YYYY-MM-DD) that have a finished workout. */
  datesWithWorkouts(): Promise<string[]>;
  /** How many finished workouts started at or before `startedAt` (so the newest one's count is its "Nth workout"). */
  countFinishedUpTo(startedAt: string): Promise<number>;
  /** Also deletes its exercises and sets. */
  remove(id: string): Promise<void>;
}
