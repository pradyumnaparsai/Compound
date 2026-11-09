import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const MIGRATIONS: string[] = [
  // v1 (never edit a shipped migration; append a new one)
  `CREATE TABLE routines (
     id TEXT PRIMARY KEY NOT NULL,
     title TEXT NOT NULL,
     recurrence TEXT NOT NULL,
     reminder_time TEXT,
     created_at TEXT NOT NULL,
     archived_at TEXT
   );
   CREATE TABLE completions (
     routine_id TEXT NOT NULL,
     date TEXT NOT NULL,
     completed_at TEXT NOT NULL,
     PRIMARY KEY (routine_id, date)
   );
   CREATE INDEX idx_completions_date ON completions(date);`,
  // v2: daily body weight
  `CREATE TABLE weights (
     date TEXT PRIMARY KEY NOT NULL,
     kg REAL NOT NULL,
     logged_at TEXT NOT NULL
   );`,
  // v3: optional Apple Health goal per routine (JSON: {type:'steps',target} | {type:'workout'})
  `ALTER TABLE routines ADD COLUMN goal TEXT;`,
  // v4: logged meals (ingredients = JSON array of {name, estimated_quantity, calories, protein_g})
  `CREATE TABLE meals (
     id TEXT PRIMARY KEY NOT NULL,
     date TEXT NOT NULL,
     logged_at TEXT NOT NULL,
     title TEXT NOT NULL,
     input_type TEXT NOT NULL,
     confidence INTEGER NOT NULL,
     ingredients TEXT NOT NULL,
     calories REAL NOT NULL,
     protein_g REAL NOT NULL,
     assumptions TEXT NOT NULL
   );
   CREATE INDEX idx_meals_date ON meals(date);`,
  // v5: carbs/fat on meals, reusable saved meals, key/value settings (goals), local per-100g food cache keyed by barcode
  `ALTER TABLE meals ADD COLUMN carbs_g REAL NOT NULL DEFAULT 0;
   ALTER TABLE meals ADD COLUMN fat_g REAL NOT NULL DEFAULT 0;
   CREATE TABLE saved_meals (
     id TEXT PRIMARY KEY NOT NULL,
     title TEXT NOT NULL,
     ingredients TEXT NOT NULL,
     calories REAL NOT NULL,
     protein_g REAL NOT NULL,
     carbs_g REAL NOT NULL,
     fat_g REAL NOT NULL,
     created_at TEXT NOT NULL
   );
   CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
   CREATE TABLE food_cache (
     barcode TEXT PRIMARY KEY NOT NULL,
     name TEXT NOT NULL,
     brand TEXT NOT NULL,
     kcal100 REAL NOT NULL,
     protein100 REAL NOT NULL,
     carbs100 REAL NOT NULL,
     fat100 REAL NOT NULL,
     pack_g REAL,
     serving_g REAL,
     updated_at TEXT NOT NULL
   );`,
  // v6: which section of the day a meal belongs to (NULL on older rows; derived from logged_at when read)
  `ALTER TABLE meals ADD COLUMN slot TEXT;`,
  // v7: user-defined routine order (seeded from the previous created_at, rowid ordering)
  `ALTER TABLE routines ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
   UPDATE routines SET position = (
     SELECT COUNT(*) FROM routines r2
     WHERE r2.created_at < routines.created_at
        OR (r2.created_at = routines.created_at AND r2.rowid < routines.rowid)
   );`,
  // v8: one-off tasks due on a specific calendar day (date = YYYY-MM-DD; completed_at NULL = still open)
  `CREATE TABLE tasks (
     id TEXT PRIMARY KEY NOT NULL,
     title TEXT NOT NULL,
     date TEXT NOT NULL,
     created_at TEXT NOT NULL,
     completed_at TEXT
   );
   CREATE INDEX idx_tasks_date ON tasks(date);`,
  `CREATE TABLE meal_schedules (
     id TEXT PRIMARY KEY NOT NULL,
     saved_meal_id TEXT NOT NULL,
     time TEXT NOT NULL,
     days TEXT,
     enabled INTEGER NOT NULL DEFAULT 1,
     created_at TEXT NOT NULL,
     last_applied TEXT
   );
   CREATE INDEX idx_meal_schedules_meal ON meal_schedules(saved_meal_id);`,
  // v10: workout tracking. Built-in exercises live in code; `exercises` holds only custom/imported ones.
  // No foreign keys on purpose: cloud restore rewrites whole tables, so repositories cascade deletes themselves.
  // source/source_id mark imported rows (e.g. 'hevy') so a re-import can skip what it already wrote.
  `CREATE TABLE exercises (
     id TEXT PRIMARY KEY NOT NULL,
     title TEXT NOT NULL,
     type TEXT NOT NULL,
     primary_muscle TEXT NOT NULL,
     secondary_muscles TEXT NOT NULL DEFAULT '[]',
     equipment TEXT NOT NULL,
     created_at TEXT NOT NULL,
     source TEXT,
     source_id TEXT
   );
   CREATE TABLE workout_folders (
     id TEXT PRIMARY KEY NOT NULL,
     title TEXT NOT NULL,
     position INTEGER NOT NULL DEFAULT 0,
     source TEXT,
     source_id TEXT
   );
   CREATE TABLE workout_templates (
     id TEXT PRIMARY KEY NOT NULL,
     title TEXT NOT NULL,
     notes TEXT NOT NULL DEFAULT '',
     folder_id TEXT,
     position INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     source TEXT,
     source_id TEXT
   );
   CREATE TABLE template_exercises (
     id TEXT PRIMARY KEY NOT NULL,
     template_id TEXT NOT NULL,
     exercise_id TEXT NOT NULL,
     position INTEGER NOT NULL,
     superset_id TEXT,
     rest_seconds INTEGER,
     notes TEXT NOT NULL DEFAULT '',
     notes_pinned INTEGER NOT NULL DEFAULT 0
   );
   CREATE INDEX idx_template_exercises_template ON template_exercises(template_id);
   CREATE TABLE template_sets (
     id TEXT PRIMARY KEY NOT NULL,
     template_exercise_id TEXT NOT NULL,
     idx INTEGER NOT NULL,
     set_type TEXT NOT NULL DEFAULT 'normal',
     rep_min INTEGER,
     rep_max INTEGER,
     weight_kg REAL,
     reps INTEGER,
     duration_seconds INTEGER,
     distance_meters REAL
   );
   CREATE INDEX idx_template_sets_exercise ON template_sets(template_exercise_id);
   CREATE TABLE workouts (
     id TEXT PRIMARY KEY NOT NULL,
     title TEXT NOT NULL,
     template_id TEXT,
     started_at TEXT NOT NULL,
     ended_at TEXT,
     date TEXT NOT NULL,
     notes TEXT NOT NULL DEFAULT '',
     source TEXT,
     source_id TEXT
   );
   CREATE INDEX idx_workouts_date ON workouts(date);
   CREATE UNIQUE INDEX idx_workouts_source ON workouts(source, source_id) WHERE source IS NOT NULL;
   CREATE TABLE workout_exercises (
     id TEXT PRIMARY KEY NOT NULL,
     workout_id TEXT NOT NULL,
     exercise_id TEXT NOT NULL,
     position INTEGER NOT NULL,
     superset_id TEXT,
     rest_seconds INTEGER,
     notes TEXT NOT NULL DEFAULT '',
     notes_pinned INTEGER NOT NULL DEFAULT 0
   );
   CREATE INDEX idx_workout_exercises_workout ON workout_exercises(workout_id);
   CREATE INDEX idx_workout_exercises_exercise ON workout_exercises(exercise_id);
   CREATE TABLE workout_sets (
     id TEXT PRIMARY KEY NOT NULL,
     workout_exercise_id TEXT NOT NULL,
     idx INTEGER NOT NULL,
     set_type TEXT NOT NULL DEFAULT 'normal',
     weight_kg REAL,
     reps INTEGER,
     duration_seconds INTEGER,
     distance_meters REAL,
     rpe REAL,
     is_completed INTEGER NOT NULL DEFAULT 0,
     completed_at TEXT
   );
   CREATE INDEX idx_workout_sets_exercise ON workout_sets(workout_exercise_id);`,
  // v11: indexes for queries that scanned whole tables (history paging, "is this exercise used", meals by day+time)
  `CREATE INDEX idx_workouts_started ON workouts(started_at);
   CREATE INDEX idx_template_exercises_exercise ON template_exercises(exercise_id);
   CREATE INDEX idx_meals_date_logged ON meals(date, logged_at);
   DROP INDEX idx_meals_date;`,
];

export async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  for (; version < MIGRATIONS.length; version++) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(MIGRATIONS[version]);
      await tx.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('productivity-booster.db');
      await migrate(db);
      return db;
    })().catch((e) => {
      dbPromise = null; // don't cache a failure: the next call retries instead of failing until restart
      throw e;
    });
  }
  return dbPromise;
}
