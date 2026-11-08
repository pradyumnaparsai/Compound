import { UserError } from '@/domain/errors';
import {
  isEquipment,
  isExerciseType,
  isMuscle,
  isSetType,
  type ExerciseDef,
  type TemplateExercise,
  type TemplateSet,
  type WorkoutFolder,
  type WorkoutTemplate,
} from '@/domain/workout';
import { getDb } from './db';
import type { ExerciseRepository, WorkoutFolderRepository, WorkoutTemplateRepository } from './repository';

// ── Exercises (custom / imported) ────────────────────────────────────────────

type ExerciseRow = {
  id: string;
  title: string;
  type: string;
  primary_muscle: string;
  secondary_muscles: string;
  equipment: string;
};

function parseMuscles(json: string) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter(isMuscle) : [];
  } catch {
    return [];
  }
}

export const sqliteExerciseRepo: ExerciseRepository = {
  async list() {
    const db = await getDb();
    const rows = await db.getAllAsync<ExerciseRow>('SELECT * FROM exercises ORDER BY title COLLATE NOCASE');
    return rows.map(
      (r): ExerciseDef => ({
        id: r.id,
        title: r.title,
        type: isExerciseType(r.type) ? r.type : 'weight_reps',
        primaryMuscle: isMuscle(r.primary_muscle) ? r.primary_muscle : 'other',
        secondaryMuscles: parseMuscles(r.secondary_muscles),
        equipment: isEquipment(r.equipment) ? r.equipment : 'other',
        isCustom: true,
      }),
    );
  },
  async add(e) {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO exercises (id, title, type, primary_muscle, secondary_muscles, equipment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      e.id,
      e.title,
      e.type,
      e.primaryMuscle,
      JSON.stringify(e.secondaryMuscles),
      e.equipment,
      new Date().toISOString(),
    );
  },
  async update(e) {
    const db = await getDb();
    await db.runAsync(
      'UPDATE exercises SET title = ?, type = ?, primary_muscle = ?, secondary_muscles = ?, equipment = ? WHERE id = ?',
      e.title,
      e.type,
      e.primaryMuscle,
      JSON.stringify(e.secondaryMuscles),
      e.equipment,
      e.id,
    );
  },
  async remove(id) {
    const db = await getDb();
    const used = await db.getFirstAsync(
      'SELECT 1 FROM template_exercises WHERE exercise_id = ? UNION ALL SELECT 1 FROM workout_exercises WHERE exercise_id = ? LIMIT 1',
      id,
      id,
    );
    if (used) throw new UserError('This exercise is used in a template or a logged workout, so it can’t be deleted.');
    await db.runAsync('DELETE FROM exercises WHERE id = ?', id);
  },
};

// ── Folders ──────────────────────────────────────────────────────────────────

export const sqliteWorkoutFolderRepo: WorkoutFolderRepository = {
  async list() {
    const db = await getDb();
    return db.getAllAsync<WorkoutFolder>('SELECT id, title, position FROM workout_folders ORDER BY position, rowid');
  },
  async add(f) {
    const db = await getDb();
    await db.runAsync('INSERT INTO workout_folders (id, title, position) VALUES (?, ?, ?)', f.id, f.title, f.position);
  },
  async rename(id, title) {
    const db = await getDb();
    await db.runAsync('UPDATE workout_folders SET title = ? WHERE id = ?', title, id);
  },
  async remove(id) {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('UPDATE workout_templates SET folder_id = NULL WHERE folder_id = ?', id);
      await tx.runAsync('DELETE FROM workout_folders WHERE id = ?', id);
    });
  },
  async reorder(ids) {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (let i = 0; i < ids.length; i++) await tx.runAsync('UPDATE workout_folders SET position = ? WHERE id = ?', i, ids[i]);
    });
  },
};

// ── Templates ────────────────────────────────────────────────────────────────

type TemplateRow = { id: string; title: string; notes: string; folder_id: string | null; position: number };
type TExRow = {
  id: string;
  template_id: string;
  exercise_id: string;
  position: number;
  superset_id: string | null;
  rest_seconds: number | null;
  notes: string;
  notes_pinned: number;
};
type TSetRow = {
  id: string;
  template_exercise_id: string;
  idx: number;
  set_type: string;
  rep_min: number | null;
  rep_max: number | null;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
};

export const sqliteWorkoutTemplateRepo: WorkoutTemplateRepository = {
  async list() {
    const db = await getDb();
    const [templates, exercises, sets] = await Promise.all([
      db.getAllAsync<TemplateRow>('SELECT id, title, notes, folder_id, position FROM workout_templates ORDER BY position, rowid'),
      db.getAllAsync<TExRow>('SELECT * FROM template_exercises ORDER BY position'),
      db.getAllAsync<TSetRow>('SELECT * FROM template_sets ORDER BY idx'),
    ]);
    const setsByEx = new Map<string, TemplateSet[]>();
    for (const s of sets) {
      const list = setsByEx.get(s.template_exercise_id) ?? [];
      list.push({
        id: s.id,
        index: s.idx,
        setType: isSetType(s.set_type) ? s.set_type : 'normal',
        repMin: s.rep_min,
        repMax: s.rep_max,
        weightKg: s.weight_kg,
        reps: s.reps,
        durationSeconds: s.duration_seconds,
        distanceMeters: s.distance_meters,
      });
      setsByEx.set(s.template_exercise_id, list);
    }
    const exByTemplate = new Map<string, TemplateExercise[]>();
    for (const e of exercises) {
      const list = exByTemplate.get(e.template_id) ?? [];
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
      exByTemplate.set(e.template_id, list);
    }
    return templates.map(
      (t): WorkoutTemplate => ({
        id: t.id,
        title: t.title,
        notes: t.notes,
        folderId: t.folder_id,
        position: t.position,
        exercises: exByTemplate.get(t.id) ?? [],
      }),
    );
  },

  async save(t) {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      const existing = await tx.getFirstAsync<{ created_at: string }>('SELECT created_at FROM workout_templates WHERE id = ?', t.id);
      await tx.runAsync(
        `INSERT INTO workout_templates (id, title, notes, folder_id, position, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, notes = excluded.notes, folder_id = excluded.folder_id, position = excluded.position`,
        t.id,
        t.title,
        t.notes,
        t.folderId,
        t.position,
        existing?.created_at ?? new Date().toISOString(),
      );
      await tx.runAsync('DELETE FROM template_sets WHERE template_exercise_id IN (SELECT id FROM template_exercises WHERE template_id = ?)', t.id);
      await tx.runAsync('DELETE FROM template_exercises WHERE template_id = ?', t.id);
      for (const e of t.exercises) {
        await tx.runAsync(
          'INSERT INTO template_exercises (id, template_id, exercise_id, position, superset_id, rest_seconds, notes, notes_pinned) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          e.id,
          t.id,
          e.exerciseId,
          e.position,
          e.supersetId,
          e.restSeconds,
          e.notes,
          e.notesPinned ? 1 : 0,
        );
        for (const s of e.sets) {
          await tx.runAsync(
            `INSERT INTO template_sets (id, template_exercise_id, idx, set_type, rep_min, rep_max, weight_kg, reps, duration_seconds, distance_meters)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            s.id,
            e.id,
            s.index,
            s.setType,
            s.repMin,
            s.repMax,
            s.weightKg,
            s.reps,
            s.durationSeconds,
            s.distanceMeters,
          );
        }
      }
    });
  },

  async remove(id) {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM template_sets WHERE template_exercise_id IN (SELECT id FROM template_exercises WHERE template_id = ?)', id);
      await tx.runAsync('DELETE FROM template_exercises WHERE template_id = ?', id);
      await tx.runAsync('DELETE FROM workout_templates WHERE id = ?', id);
    });
  },

  async reorder(ids) {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (let i = 0; i < ids.length; i++) await tx.runAsync('UPDATE workout_templates SET position = ? WHERE id = ?', i, ids[i]);
    });
  },
};
