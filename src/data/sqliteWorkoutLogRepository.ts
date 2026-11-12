import { toKey } from '@/domain/date';
import { isSetType, type Workout, type WorkoutExercise, type WorkoutSet } from '@/domain/workout';
import { getDb } from './db';
import type { WorkoutRepository } from './repository';

type WorkoutRow = { id: string; title: string; template_id: string | null; started_at: string; ended_at: string | null; date: string; notes: string };
type ExRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  superset_id: string | null;
  rest_seconds: number | null;
  notes: string;
  notes_pinned: number;
};
type SetRow = {
  id: string;
  workout_exercise_id: string;
  idx: number;
  set_type: string;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  rpe: number | null;
  is_completed: number;
  completed_at: string | null;
};

type Db = Awaited<ReturnType<typeof getDb>>;
const CHUNK = 400; // SQLite allows 999 bound variables per statement
const marks = (n: number) => Array(n).fill('?').join(', ');

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

/** Loads exercises and sets for the given workout rows (optionally only some exercises) and assembles them. */
async function hydrate(db: Db, rows: WorkoutRow[], onlyExerciseIds?: string[]): Promise<Workout[]> {
  if (rows.length === 0) return [];
  const exercises: ExRow[] = [];
  for (const ids of chunks(rows.map((r) => r.id))) {
    const filter = onlyExerciseIds ? ` AND exercise_id IN (${marks(onlyExerciseIds.length)})` : '';
    exercises.push(
      ...(await db.getAllAsync<ExRow>(
        `SELECT * FROM workout_exercises WHERE workout_id IN (${marks(ids.length)})${filter} ORDER BY position`,
        ...ids,
        ...(onlyExerciseIds ?? []),
      )),
    );
  }
  const sets: SetRow[] = [];
  for (const ids of chunks(exercises.map((e) => e.id))) {
    sets.push(
      ...(await db.getAllAsync<SetRow>(`SELECT * FROM workout_sets WHERE workout_exercise_id IN (${marks(ids.length)}) ORDER BY idx`, ...ids)),
    );
  }
  const setsByEx = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const list = setsByEx.get(s.workout_exercise_id) ?? [];
    list.push({
      id: s.id,
      index: s.idx,
      setType: isSetType(s.set_type) ? s.set_type : 'normal',
      weightKg: s.weight_kg,
      reps: s.reps,
      durationSeconds: s.duration_seconds,
      distanceMeters: s.distance_meters,
      rpe: s.rpe,
      isCompleted: s.is_completed === 1,
      completedAt: s.completed_at,
    });
    setsByEx.set(s.workout_exercise_id, list);
  }
  const exByWorkout = new Map<string, WorkoutExercise[]>();
  for (const e of exercises) {
    const list = exByWorkout.get(e.workout_id) ?? [];
    list.push({
      id: e.id,
      exerciseId: e.exercise_id,
      position: e.position,
      supersetId: e.superset_id,
      restSeconds: e.rest_seconds,
      notes: e.notes,
      notesPinned: e.notes_pinned === 1,
      sets: setsByEx.get(e.id) ?? [],
    });
    exByWorkout.set(e.workout_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    templateId: r.template_id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    date: r.date,
    notes: r.notes,
    exercises: exByWorkout.get(r.id) ?? [],
  }));
}

const COLS = 'id, title, template_id, started_at, ended_at, date, notes';

export const sqliteWorkoutRepo: WorkoutRepository = {
  async getActive() {
    const db = await getDb();
    const row = await db.getFirstAsync<WorkoutRow>(`SELECT ${COLS} FROM workouts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`);
    return row ? (await hydrate(db, [row]))[0] : null;
  },

  async save(w) {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT INTO workouts (id, title, template_id, started_at, ended_at, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, template_id = excluded.template_id, started_at = excluded.started_at,
           ended_at = excluded.ended_at, date = excluded.date, notes = excluded.notes`,
        w.id,
        w.title,
        w.templateId,
        w.startedAt,
        w.endedAt,
        w.date || toKey(new Date(w.startedAt)),
        w.notes,
      );
      await tx.runAsync('DELETE FROM workout_sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)', w.id);
      await tx.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', w.id);
      for (const e of w.exercises) {
        await tx.runAsync(
          'INSERT INTO workout_exercises (id, workout_id, exercise_id, position, superset_id, rest_seconds, notes, notes_pinned) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          e.id,
          w.id,
          e.exerciseId,
          e.position,
          e.supersetId,
          e.restSeconds,
          e.notes,
          e.notesPinned ? 1 : 0,
        );
        for (const s of e.sets) {
          await tx.runAsync(
            `INSERT INTO workout_sets (id, workout_exercise_id, idx, set_type, weight_kg, reps, duration_seconds, distance_meters, rpe, is_completed, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            s.id,
            e.id,
            s.index,
            s.setType,
            s.weightKg,
            s.reps,
            s.durationSeconds,
            s.distanceMeters,
            s.rpe,
            s.isCompleted ? 1 : 0,
            s.completedAt,
          );
        }
      }
    });
  },

  async get(id) {
    const db = await getDb();
    const row = await db.getFirstAsync<WorkoutRow>(`SELECT ${COLS} FROM workouts WHERE id = ?`, id);
    return row ? (await hydrate(db, [row]))[0] : null;
  },

  async listRecent(limit, before) {
    const db = await getDb();
    const rows = before
      ? await db.getAllAsync<WorkoutRow>(`SELECT ${COLS} FROM workouts WHERE ended_at IS NOT NULL AND started_at < ? ORDER BY started_at DESC LIMIT ?`, before, limit)
      : await db.getAllAsync<WorkoutRow>(`SELECT ${COLS} FROM workouts WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?`, limit);
    return hydrate(db, rows);
  },

  async listForExercises(exerciseIds) {
    if (exerciseIds.length === 0) return [];
    const db = await getDb();
    const rows = await db.getAllAsync<WorkoutRow>(
      `SELECT ${COLS} FROM workouts WHERE ended_at IS NOT NULL AND id IN (
         SELECT workout_id FROM workout_exercises WHERE exercise_id IN (${marks(exerciseIds.length)})
       ) ORDER BY started_at DESC`,
      ...exerciseIds,
    );
    return (await hydrate(db, rows, exerciseIds)).filter((w) => w.exercises.length > 0);
  },

  async listByDate(date) {
    const db = await getDb();
    const rows = await db.getAllAsync<WorkoutRow>(`SELECT ${COLS} FROM workouts WHERE ended_at IS NOT NULL AND date = ? ORDER BY started_at`, date);
    return hydrate(db, rows);
  },

  async datesWithWorkouts() {
    const db = await getDb();
    return (await db.getAllAsync<{ date: string }>('SELECT DISTINCT date FROM workouts WHERE ended_at IS NOT NULL ORDER BY date')).map((r) => r.date);
  },

  async countFinishedUpTo(startedAt) {
    const db = await getDb();
    const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM workouts WHERE ended_at IS NOT NULL AND started_at <= ?', startedAt);
    return row?.c ?? 0;
  },

  async remove(id) {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM workout_sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)', id);
      await tx.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', id);
      await tx.runAsync('DELETE FROM workouts WHERE id = ?', id);
    });
  },
};
