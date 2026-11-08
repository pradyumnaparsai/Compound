import { newId } from '@/domain/id';
import { buildImportPlan, HEVY_SOURCE, parseHevyCsv } from '@/domain/hevyImport';
import { getDb } from './db';

export type HevyImportResult = {
  workouts: number;
  alreadyThere: number;
  templates: number;
  exercises: number;
  skippedRows: number;
};

/**
 * Writes a Hevy CSV export in one transaction: custom exercises, templates and finished workouts, all tagged
 * source = 'hevy' so running it again skips what is already there. Never touches Apple Health or routine goals.
 */
export async function importHevyCsv(text: string): Promise<HevyImportResult> {
  const parsed = parseHevyCsv(text);
  const db = await getDb();
  const now = new Date().toISOString();

  const tpl = await db.getAllAsync<{ id: string; title: string }>('SELECT id, title FROM workout_templates');
  const existingTemplates: Record<string, string> = {};
  for (const t of tpl) existingTemplates[t.title.trim().toLowerCase()] = t.id;
  const templateStart = (await db.getFirstAsync<{ n: number }>('SELECT COALESCE(MAX(position) + 1, 0) AS n FROM workout_templates'))?.n ?? 0;

  const plan = buildImportPlan(parsed, { makeId: newId, existingTemplates, templateStart });
  const result: HevyImportResult = { workouts: 0, alreadyThere: 0, templates: 0, exercises: 0, skippedRows: parsed.skippedRows };

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const { def, sourceId } of plan.exercises) {
      const r = await tx.runAsync(
        `INSERT OR IGNORE INTO exercises (id, title, type, primary_muscle, secondary_muscles, equipment, created_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        def.id, def.title, def.type, def.primaryMuscle, JSON.stringify(def.secondaryMuscles), def.equipment, now, HEVY_SOURCE, sourceId,
      );
      result.exercises += r.changes;
    }

    for (const { template: t, sourceId } of plan.templates) {
      await tx.runAsync(
        'INSERT INTO workout_templates (id, title, notes, folder_id, position, created_at, source, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        t.id, t.title, t.notes, t.folderId, t.position, now, HEVY_SOURCE, sourceId,
      );
      for (const e of t.exercises) {
        await tx.runAsync(
          'INSERT INTO template_exercises (id, template_id, exercise_id, position, superset_id, rest_seconds, notes, notes_pinned) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          e.id, t.id, e.exerciseId, e.position, e.supersetId, e.restSeconds, e.notes, 0,
        );
        for (const s of e.sets) {
          await tx.runAsync(
            `INSERT INTO template_sets (id, template_exercise_id, idx, set_type, rep_min, rep_max, weight_kg, reps, duration_seconds, distance_meters)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            s.id, e.id, s.index, s.setType, s.repMin, s.repMax, s.weightKg, s.reps, s.durationSeconds, s.distanceMeters,
          );
        }
      }
      result.templates++;
    }

    for (const { workout: w, sourceId } of plan.workouts) {
      const r = await tx.runAsync(
        `INSERT OR IGNORE INTO workouts (id, title, template_id, started_at, ended_at, date, notes, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        w.id, w.title, w.templateId, w.startedAt, w.endedAt, w.date, w.notes, HEVY_SOURCE, sourceId,
      );
      if (r.changes === 0) {
        result.alreadyThere++;
        continue;
      }
      result.workouts++;
      for (const e of w.exercises) {
        await tx.runAsync(
          'INSERT INTO workout_exercises (id, workout_id, exercise_id, position, superset_id, rest_seconds, notes, notes_pinned) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          e.id, w.id, e.exerciseId, e.position, e.supersetId, e.restSeconds, e.notes, 0,
        );
        for (const s of e.sets) {
          await tx.runAsync(
            `INSERT INTO workout_sets (id, workout_exercise_id, idx, set_type, weight_kg, reps, duration_seconds, distance_meters, rpe, is_completed, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            s.id, e.id, s.index, s.setType, s.weightKg, s.reps, s.durationSeconds, s.distanceMeters, s.rpe, s.completedAt,
          );
        }
      }
    }
  });
  return result;
}
