import { todayKey } from '@/domain/date';
import type { Completion, Goal, Recurrence, Routine, RoutineInput, Task } from '@/domain/types';
import type { Food } from '@/domain/food';
import { isMealSlot, normalizeIngredient, slotForTime, type Goals, type Meal, type SavedMeal } from '@/domain/meal';
import type { MealSchedule } from '@/domain/mealSchedule';
import type { WeightEntry } from '@/domain/weight';
import { getDb } from './db';
import type {
  CompletionRepository,
  FoodCacheRepository,
  MealRepository,
  MealScheduleRepository,
  PrepRepository,
  RoutineRepository,
  SavedMealRepository,
  SettingsRepository,
  TaskRepository,
  WeightRepository,
} from './repository';
import { newId } from '@/domain/id';

type MealRow = {
  id: string;
  date: string;
  slot: string | null;
  logged_at: string;
  title: string;
  input_type: Meal['inputType'];
  confidence: number;
  ingredients: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  assumptions: string;
};

/** Stored JSON that fails to parse (e.g. from a damaged cloud backup) falls back instead of breaking the whole list. */
function parseJson<T>(raw: string, fallback: T): T {
  try {
    const v = JSON.parse(raw) as T;
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

const parseIngredients = (raw: string) => {
  const list = parseJson<unknown>(raw, []);
  return (Array.isArray(list) ? (list as Partial<Meal['ingredients'][number]>[]) : []).map(normalizeIngredient);
};

export const mealFromRow = (r: MealRow): Meal => ({
  id: r.id,
  date: r.date,
  slot: isMealSlot(r.slot) ? r.slot : slotForTime(r.logged_at),
  loggedAt: r.logged_at,
  title: r.title,
  inputType: r.input_type,
  confidence: r.confidence,
  ingredients: parseIngredients(r.ingredients),
  calories: r.calories,
  proteinG: r.protein_g,
  carbsG: r.carbs_g,
  fatG: r.fat_g,
  assumptions: parseJson<string[]>(r.assumptions, []),
});

export const sqliteMealRepo: MealRepository = {
  async list() {
    const db = await getDb();
    const rows = await db.getAllAsync<MealRow>('SELECT * FROM meals ORDER BY date, logged_at');
    return rows.map(mealFromRow);
  },
  async add(m) {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO meals (id, date, slot, logged_at, title, input_type, confidence, ingredients, calories, protein_g, carbs_g, fat_g, assumptions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      m.id,
      m.date,
      m.slot,
      m.loggedAt,
      m.title,
      m.inputType,
      m.confidence,
      JSON.stringify(m.ingredients),
      m.calories,
      m.proteinG,
      m.carbsG,
      m.fatG,
      JSON.stringify(m.assumptions),
    );
  },
  async update(m) {
    const db = await getDb();
    await db.runAsync(
      'UPDATE meals SET title = ?, slot = ?, ingredients = ?, calories = ?, protein_g = ?, carbs_g = ?, fat_g = ? WHERE id = ?',
      m.title,
      m.slot,
      JSON.stringify(m.ingredients),
      m.calories,
      m.proteinG,
      m.carbsG,
      m.fatG,
      m.id,
    );
  },
  async remove(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM meals WHERE id = ?', id);
  },
};

type RoutineRow = {
  id: string;
  title: string;
  recurrence: string;
  reminder_time: string | null;
  goal: string | null;
  created_at: string;
  archived_at: string | null;
};


function parseGoal(raw: string | null): Goal | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Goal;
  } catch {
    return null;
  }
}

function parseRecurrence(raw: string): Recurrence {
  const v = parseJson<Partial<Recurrence> | null>(raw, null);
  if (v?.type === 'weekly' && Array.isArray(v.days)) return { type: 'weekly', days: v.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) };
  return { type: 'daily' };
}

export const toRoutine = (r: RoutineRow): Routine => ({
  id: r.id,
  title: r.title,
  recurrence: parseRecurrence(r.recurrence),
  goal: parseGoal(r.goal),
  reminderTime: r.reminder_time,
  createdAt: r.created_at,
  archivedAt: r.archived_at,
});

export const sqliteRoutineRepo: RoutineRepository = {
  async list() {
    const db = await getDb();
    const rows = await db.getAllAsync<RoutineRow>('SELECT * FROM routines ORDER BY position, created_at, rowid');
    return rows.map(toRoutine);
  },

  async create(input: RoutineInput) {
    const db = await getDb();
    const routine: Routine = {
      id: newId(),
      title: input.title.trim(),
      recurrence: input.recurrence,
      goal: input.goal ?? null,
      reminderTime: input.reminderTime ?? null,
      createdAt: todayKey(),
      archivedAt: null,
    };
    await db.runAsync(
      'INSERT INTO routines (id, title, recurrence, reminder_time, goal, created_at, position) VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM routines))',
      routine.id,
      routine.title,
      JSON.stringify(routine.recurrence),
      routine.reminderTime,
      routine.goal ? JSON.stringify(routine.goal) : null,
      routine.createdAt,
    );
    return routine;
  },

  async update(id, patch) {
    const db = await getDb();
    await db.runAsync(
      'UPDATE routines SET title = ?, recurrence = ?, reminder_time = ?, goal = ? WHERE id = ?',
      patch.title.trim(),
      JSON.stringify(patch.recurrence),
      patch.reminderTime ?? null,
      patch.goal ? JSON.stringify(patch.goal) : null,
      id,
    );
  },

  async archive(id) {
    const db = await getDb();
    await db.runAsync('UPDATE routines SET archived_at = ? WHERE id = ?', todayKey(), id);
  },

  async reorder(ids) {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.runAsync('UPDATE routines SET position = ? WHERE id = ?', i, ids[i]);
      }
    });
  },
};

export const sqliteCompletionRepo: CompletionRepository = {
  async list() {
    const db = await getDb();
    const rows = await db.getAllAsync<{ routine_id: string; date: string }>(
      'SELECT routine_id, date FROM completions',
    );
    return rows.map((r): Completion => ({ routineId: r.routine_id, date: r.date }));
  },

  async set(routineId, date, done) {
    const db = await getDb();
    if (done) {
      await db.runAsync(
        'INSERT OR IGNORE INTO completions (routine_id, date, completed_at) VALUES (?, ?, ?)',
        routineId,
        date,
        new Date().toISOString(),
      );
    } else {
      await db.runAsync('DELETE FROM completions WHERE routine_id = ? AND date = ?', routineId, date);
    }
  },
};

type TaskRow = { id: string; title: string; date: string; created_at: string; completed_at: string | null };

export const sqliteTaskRepo: TaskRepository = {
  async list() {
    const db = await getDb();
    const rows = await db.getAllAsync<TaskRow>('SELECT * FROM tasks ORDER BY date, created_at, rowid');
    return rows.map(
      (r): Task => ({ id: r.id, title: r.title, date: r.date, createdAt: r.created_at, completedAt: r.completed_at }),
    );
  },
  async create(title, date) {
    const db = await getDb();
    const task: Task = { id: newId(), title: title.trim(), date, createdAt: new Date().toISOString(), completedAt: null };
    await db.runAsync(
      'INSERT INTO tasks (id, title, date, created_at) VALUES (?, ?, ?, ?)',
      task.id,
      task.title,
      task.date,
      task.createdAt,
    );
    return task;
  },
  async setDone(id, done) {
    const db = await getDb();
    const completedAt = done ? new Date().toISOString() : null;
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE id = ?', completedAt, id);
    return completedAt;
  },
  async reschedule(id, date) {
    const db = await getDb();
    await db.runAsync('UPDATE tasks SET date = ? WHERE id = ?', date, id);
  },
  async remove(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
  },
};

export const sqlitePrepRepo: PrepRepository = {
  async list() {
    const db = await getDb();
    return (await db.getAllAsync<{ key: string }>('SELECT key FROM prep_checks')).map((r) => r.key);
  },
  async setMany(keys, done) {
    if (keys.length === 0) return;
    const db = await getDb();
    const marks = keys.map(() => '?').join(', ');
    if (done) {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT OR REPLACE INTO prep_checks (key, done_at) VALUES ${keys.map(() => '(?, ?)').join(', ')}`,
        keys.flatMap((k) => [k, now]),
      );
    } else {
      await db.runAsync(`DELETE FROM prep_checks WHERE key IN (${marks})`, keys);
    }
  },
};

export const sqliteWeightRepo: WeightRepository = {
  async list() {
    const db = await getDb();
    return db.getAllAsync<WeightEntry>('SELECT date, kg FROM weights ORDER BY date');
  },
  async upsert(date, kg) {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO weights (date, kg, logged_at) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET kg = excluded.kg, logged_at = excluded.logged_at',
      date,
      kg,
      new Date().toISOString(),
    );
  },
  async remove(date) {
    const db = await getDb();
    await db.runAsync('DELETE FROM weights WHERE date = ?', date);
  },
};

type SavedRow = {
  id: string;
  title: string;
  ingredients: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
};

export const sqliteSavedMealRepo: SavedMealRepository = {
  async list() {
    const db = await getDb();
    const rows = await db.getAllAsync<SavedRow>('SELECT * FROM saved_meals ORDER BY title COLLATE NOCASE');
    return rows.map(
      (r): SavedMeal => ({
        id: r.id,
        title: r.title,
        ingredients: parseIngredients(r.ingredients),
        calories: r.calories,
        proteinG: r.protein_g,
        carbsG: r.carbs_g,
        fatG: r.fat_g,
        createdAt: r.created_at,
      }),
    );
  },
  async add(m) {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO saved_meals (id, title, ingredients, calories, protein_g, carbs_g, fat_g, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      m.id,
      m.title,
      JSON.stringify(m.ingredients),
      m.calories,
      m.proteinG,
      m.carbsG,
      m.fatG,
      m.createdAt,
    );
  },
  async update(m) {
    const db = await getDb();
    await db.runAsync(
      'UPDATE saved_meals SET title = ?, ingredients = ?, calories = ?, protein_g = ?, carbs_g = ?, fat_g = ? WHERE id = ?',
      m.title,
      JSON.stringify(m.ingredients),
      m.calories,
      m.proteinG,
      m.carbsG,
      m.fatG,
      m.id,
    );
  },
  async remove(id) {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM meal_schedules WHERE saved_meal_id = ?', id);
      await tx.runAsync('DELETE FROM saved_meals WHERE id = ?', id);
    });
  },
};

type ScheduleRow = {
  id: string;
  saved_meal_id: string;
  time: string;
  days: string | null;
  enabled: number;
  created_at: string;
  last_applied: string | null;
};

const parseDays = (raw: string | null): number[] | null => {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 6) : null;
  } catch {
    return null;
  }
};

export const sqliteMealScheduleRepo: MealScheduleRepository = {
  async list() {
    const db = await getDb();
    const rows = await db.getAllAsync<ScheduleRow>('SELECT * FROM meal_schedules ORDER BY time, created_at');
    return rows.map(
      (r): MealSchedule => ({
        id: r.id,
        savedMealId: r.saved_meal_id,
        time: r.time,
        days: parseDays(r.days),
        enabled: r.enabled === 1,
        createdAt: r.created_at,
        lastApplied: r.last_applied,
      }),
    );
  },
  async add(s) {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO meal_schedules (id, saved_meal_id, time, days, enabled, created_at, last_applied) VALUES (?, ?, ?, ?, ?, ?, ?)',
      s.id,
      s.savedMealId,
      s.time,
      s.days ? JSON.stringify(s.days) : null,
      s.enabled ? 1 : 0,
      s.createdAt,
      s.lastApplied,
    );
  },
  async update(s) {
    const db = await getDb();
    await db.runAsync(
      'UPDATE meal_schedules SET time = ?, days = ?, enabled = ?, created_at = ? WHERE id = ?',
      s.time,
      s.days ? JSON.stringify(s.days) : null,
      s.enabled ? 1 : 0,
      s.createdAt,
      s.id,
    );
  },
  async remove(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM meal_schedules WHERE id = ?', id);
  },
  async claim(id, date) {
    const db = await getDb();
    const r = await db.runAsync(
      'UPDATE meal_schedules SET last_applied = ? WHERE id = ? AND (last_applied IS NULL OR last_applied != ?)',
      date,
      id,
      date,
    );
    return r.changes === 1;
  },
  async release(id, previous) {
    const db = await getDb();
    await db.runAsync('UPDATE meal_schedules SET last_applied = ? WHERE id = ?', previous, id);
  },
};

export const sqliteSettingsRepo: SettingsRepository = {
  async getGoals() {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'goals'");
    if (!row) return null;
    try {
      const g = JSON.parse(row.value) as Goals;
      if (!Number.isFinite(g.calories) || !Number.isFinite(g.proteinG)) return null;
      const opt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
      return { calories: g.calories, proteinG: g.proteinG, carbsG: opt(g.carbsG), fatG: opt(g.fatG) };
    } catch {
      return null;
    }
  },
  async setGoals(g) {
    const db = await getDb();
    if (!g) {
      await db.runAsync("DELETE FROM settings WHERE key = 'goals'");
      return;
    }
    await db.runAsync(
      "INSERT INTO settings (key, value) VALUES ('goals', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      JSON.stringify(g),
    );
  },
  async getFlag(key) {
    const db = await getDb();
    return !!(await db.getFirstAsync('SELECT 1 FROM settings WHERE key = ?', `flag_${key}`));
  },
  async setFlag(key) {
    const db = await getDb();
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, '1')", `flag_${key}`);
  },
  async getValue(key) {
    const db = await getDb();
    return (await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key))?.value ?? null;
  },
  async setValue(key, value) {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  },
};

type FoodRow = {
  barcode: string;
  name: string;
  brand: string;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  pack_g: number | null;
  serving_g: number | null;
};

const FOOD_CACHE_MAX = 500;

export const sqliteFoodCacheRepo: FoodCacheRepository = {
  async get(barcode) {
    const db = await getDb();
    const r = await db.getFirstAsync<FoodRow>('SELECT * FROM food_cache WHERE barcode = ?', barcode);
    if (!r) return null;
    return {
      barcode: r.barcode,
      name: r.name,
      brand: r.brand,
      kcal100: r.kcal100,
      protein100: r.protein100,
      carbs100: r.carbs100,
      fat100: r.fat100,
      packG: r.pack_g,
      servingG: r.serving_g,
    };
  },
  async put(f: Food) {
    if (!f.barcode) return;
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO food_cache (barcode, name, brand, kcal100, protein100, carbs100, fat100, pack_g, serving_g, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(barcode) DO UPDATE SET name = excluded.name, brand = excluded.brand, kcal100 = excluded.kcal100,
         protein100 = excluded.protein100, carbs100 = excluded.carbs100, fat100 = excluded.fat100,
         pack_g = excluded.pack_g, serving_g = excluded.serving_g, updated_at = excluded.updated_at`,
      f.barcode,
      f.name,
      f.brand,
      f.kcal100,
      f.protein100,
      f.carbs100,
      f.fat100,
      f.packG,
      f.servingG,
      new Date().toISOString(),
    );
    // A rebuildable cache must not grow forever: keep the most recently saved entries only.
    await db.runAsync(
      'DELETE FROM food_cache WHERE barcode IN (SELECT barcode FROM food_cache ORDER BY updated_at DESC LIMIT -1 OFFSET ?)',
      FOOD_CACHE_MAX,
    );
  },
};
