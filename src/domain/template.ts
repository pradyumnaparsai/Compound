// Template helpers: creating, duplicating, comparing a performed workout with its template, and updating it.
import { normalizeSupersets, renumber, type TemplateExercise, type TemplateSet, type Workout, type WorkoutTemplate } from './workout';

export const emptyTemplateSet = (id: string, index: number): TemplateSet => ({
  id,
  index,
  setType: 'normal',
  repMin: null,
  repMax: null,
  weightKg: null,
  reps: null,
  durationSeconds: null,
  distanceMeters: null,
});

export const newTemplateExercise = (id: string, setId: string, exerciseId: string, position: number): TemplateExercise => ({
  id,
  exerciseId,
  position,
  supersetId: null,
  restSeconds: null, // rest between sets is opt-in
  notes: '',
  notesPinned: false,
  sets: [emptyTemplateSet(setId, 0)],
});

/** Copy with every id regenerated (superset links stay consistent) and " copy" appended to the title. */
export function duplicateTemplate(t: WorkoutTemplate, makeId: () => string, position: number): WorkoutTemplate {
  const supersetMap = new Map<string, string>();
  return {
    ...t,
    id: makeId(),
    title: `${t.title} copy`,
    position,
    exercises: t.exercises.map((e) => {
      let supersetId = e.supersetId;
      if (supersetId) {
        if (!supersetMap.has(supersetId)) supersetMap.set(supersetId, makeId());
        supersetId = supersetMap.get(supersetId)!;
      }
      return { ...e, id: makeId(), supersetId, sets: e.sets.map((s) => ({ ...s, id: makeId() })) };
    }),
  };
}

export type TemplateDiff = {
  /** Exercises that were added to or dropped from the session. A major change. */
  addedExerciseIds: string[];
  removedExerciseIds: string[];
  /** Same exercises, different set counts / weights / reps / order / supersets / rest. Minor changes. */
  changedExerciseIds: string[];
  major: boolean;
  minor: boolean;
};

const key = (exerciseId: string, n: number) => `${exerciseId}#${n}`;

/** Exercises of a workout that have at least one completed set, with their completed sets only. */
function performed(w: Pick<Workout, 'exercises'>) {
  return w.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.isCompleted) }))
    .filter((e) => e.sets.length > 0);
}

/**
 * Compares what was actually done (completed sets only) with the template. Added/removed exercises are
 * "major"; set counts, weights, reps, order, supersets and rest are "minor". An exercise repeated within a
 * session is matched occurrence by occurrence.
 */
export function diffTemplate(template: Pick<WorkoutTemplate, 'exercises'>, workout: Pick<Workout, 'exercises'>): TemplateDiff {
  const occurrence = (list: { exerciseId: string }[]) => {
    const seen = new Map<string, number>();
    return list.map((e) => {
      const n = seen.get(e.exerciseId) ?? 0;
      seen.set(e.exerciseId, n + 1);
      return key(e.exerciseId, n);
    });
  };
  const done = performed(workout);
  const tplKeys = occurrence(template.exercises);
  const doneKeys = occurrence(done);
  const tplByKey = new Map(template.exercises.map((e, i) => [tplKeys[i], e]));

  const added: string[] = [];
  const changed = new Set<string>();
  const matchedInWorkoutOrder: string[] = [];
  done.forEach((e, i) => {
    const t = tplByKey.get(doneKeys[i]);
    if (!t) {
      added.push(e.exerciseId);
      return;
    }
    matchedInWorkoutOrder.push(doneKeys[i]);
    const sameSets =
      t.sets.length === e.sets.length &&
      t.sets.every((s, idx) => {
        const w = e.sets[idx];
        // A template number that is left empty is "no target" (e.g. imported templates): whatever you lifted is not a change.
        const sameWeight = s.weightKg === null || s.weightKg === w.weightKg;
        const sameReps = s.reps === null || s.reps === w.reps;
        return s.setType === w.setType && sameWeight && sameReps;
      });
    const sameRest = (t.restSeconds ?? null) === (e.restSeconds ?? null);
    const sameLink = !!t.supersetId === !!e.supersetId;
    if (!sameSets || !sameRest || !sameLink) changed.add(e.exerciseId);
  });

  const matched = new Set(matchedInWorkoutOrder);
  const removed = template.exercises.filter((_, i) => !matched.has(tplKeys[i])).map((e) => e.exerciseId);
  const reordered = tplKeys.filter((k) => matched.has(k)).join('|') !== matchedInWorkoutOrder.join('|');
  return {
    addedExerciseIds: added,
    removedExerciseIds: removed,
    changedExerciseIds: [...changed],
    major: added.length > 0 || removed.length > 0,
    minor: changed.size > 0 || reordered,
  };
}

/** Whether to ask "Update template?" after a workout: always for major changes, for minor ones only if `includeMinor`. */
export const shouldOfferTemplateUpdate = (d: TemplateDiff, includeMinor = false) => d.major || (includeMinor && d.minor);

/**
 * Template reflecting what was performed: exercises in performed order, one target set per completed set
 * (type, weight, reps, duration, distance). Rep ranges of matching exercise/set positions are kept.
 */
export function templateFromWorkout(
  template: WorkoutTemplate,
  workout: Pick<Workout, 'exercises'>,
  makeId: () => string,
): WorkoutTemplate {
  const used = new Set<string>();
  const exercises = performed(workout).map((e): TemplateExercise => {
    const prev = template.exercises.find((t) => t.exerciseId === e.exerciseId && !used.has(t.id));
    if (prev) used.add(prev.id);
    return {
      id: prev?.id ?? makeId(),
      exerciseId: e.exerciseId,
      position: 0,
      supersetId: e.supersetId,
      restSeconds: e.restSeconds,
      notes: e.notes,
      notesPinned: e.notesPinned,
      sets: e.sets.map((s, idx) => ({
        id: prev?.sets[idx]?.id ?? makeId(),
        index: idx,
        setType: s.setType,
        repMin: prev?.sets[idx]?.repMin ?? null,
        repMax: prev?.sets[idx]?.repMax ?? null,
        weightKg: s.weightKg,
        reps: s.reps,
        durationSeconds: s.durationSeconds,
        distanceMeters: s.distanceMeters,
      })),
    };
  });
  return { ...template, exercises: renumber(normalizeSupersets(exercises)) };
}

/** Moves `ids` (a subset, in its new order) into the slots those ids occupy in `all`; others keep their slots. */
export function reorderSubset<T extends { id: string }>(all: T[], visibleIds: string[]): T[] {
  const byId = new Map(all.map((r) => [r.id, r]));
  const ids = visibleIds.filter((id) => byId.has(id));
  const idSet = new Set(ids);
  const next = [...all];
  let k = 0;
  all.forEach((r, i) => {
    if (idSet.has(r.id)) next[i] = byId.get(ids[k++])!;
  });
  return next;
}
