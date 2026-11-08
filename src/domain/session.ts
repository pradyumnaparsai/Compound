// Pure edits of a workout being logged (or edited afterwards): start from a template, add/remove/replace
// exercises, add sets, tick sets off, finish. The store wraps these; nothing here touches storage or time.
import { toKey } from './date';
import {
  DEFAULT_REST_SECONDS,
  linkWithNext,
  normalizeSupersets,
  renumber,
  renumberSets,
  unlinkExercise,
  SET_TYPES,
  type SetType,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
  type WorkoutTemplate,
} from './workout';

type MakeId = () => string;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const defaultWorkoutTitle = (d: Date) => `${WEEKDAYS[d.getDay()]} workout`;

const blankSet = (id: string, index: number): WorkoutSet => ({
  id,
  index,
  setType: 'normal',
  weightKg: null,
  reps: null,
  durationSeconds: null,
  distanceMeters: null,
  rpe: null,
  isCompleted: false,
  completedAt: null,
});

/**
 * The last time the exercise was performed (completed sets only): preferably inside a workout started from the
 * same template, otherwise in any workout. Newest first. Null when it was never done.
 */
export function lastPerformance(history: Workout[], exerciseId: string, templateId: string | null): WorkoutExercise | null {
  let best: { w: Workout; e: WorkoutExercise; sameTemplate: boolean } | null = null;
  for (const w of history) {
    if (!w.endedAt) continue;
    const e = w.exercises.find((x) => x.exerciseId === exerciseId && x.sets.some((s) => s.isCompleted));
    if (!e) continue;
    const sameTemplate = !!templateId && w.templateId === templateId;
    if (!best || (sameTemplate && !best.sameTemplate) || (sameTemplate === best.sameTemplate && w.startedAt > best.w.startedAt)) {
      best = { w, e, sameTemplate };
    }
  }
  return best ? { ...best.e, sets: best.e.sets.filter((s) => s.isCompleted) } : null;
}

/** The previous set shown next to set `index` (matched by position among the completed sets). */
export const previousSet = (prev: WorkoutExercise | null | undefined, index: number): WorkoutSet | null => prev?.sets[index] ?? null;

/** Exercise ready to log: sets prefilled from the template (or last time), notes carried over when pinned. */
function buildExercise(
  makeId: MakeId,
  exerciseId: string,
  position: number,
  prev: WorkoutExercise | null,
  tpl: WorkoutTemplate['exercises'][number] | null,
): WorkoutExercise {
  const count = tpl ? tpl.sets.length : prev ? Math.min(Math.max(prev.sets.length, 1), 6) : 1;
  const sets: WorkoutSet[] = [];
  for (let i = 0; i < count; i++) {
    const t = tpl?.sets[i];
    const p = prev?.sets[i] ?? prev?.sets[prev.sets.length - 1];
    sets.push({
      ...blankSet(makeId(), i),
      setType: t?.setType ?? (prev?.sets[i]?.setType === 'warmup' ? 'warmup' : 'normal'),
      weightKg: t?.weightKg ?? p?.weightKg ?? null,
      reps: t?.reps ?? p?.reps ?? null,
      durationSeconds: t?.durationSeconds ?? p?.durationSeconds ?? null,
      distanceMeters: t?.distanceMeters ?? p?.distanceMeters ?? null,
    });
  }
  const pinnedNotes = tpl?.notesPinned && tpl.notes ? tpl : prev?.notesPinned ? prev : null;
  return {
    id: makeId(),
    exerciseId,
    position,
    supersetId: tpl?.supersetId ?? null,
    restSeconds: tpl?.restSeconds ?? prev?.restSeconds ?? DEFAULT_REST_SECONDS,
    notes: pinnedNotes ? pinnedNotes.notes : tpl?.notes ?? '',
    notesPinned: !!pinnedNotes,
    sets,
  };
}

export function startWorkout(args: {
  id: string;
  now: Date;
  template: WorkoutTemplate | null;
  history: Workout[];
  makeId: MakeId;
}): Workout {
  const { id, now, template, history, makeId } = args;
  const exercises = (template?.exercises ?? []).map((te, i) =>
    buildExercise(makeId, te.exerciseId, i, lastPerformance(history, te.exerciseId, template?.id ?? null), te),
  );
  return {
    id,
    title: template?.title ?? defaultWorkoutTitle(now),
    templateId: template?.id ?? null,
    startedAt: now.toISOString(),
    endedAt: null,
    date: toKey(now),
    notes: '',
    exercises: renumber(exercises),
  };
}

const mapExercise = (w: Workout, exId: string, fn: (e: WorkoutExercise) => WorkoutExercise): Workout => ({
  ...w,
  exercises: w.exercises.map((e) => (e.id === exId ? fn(e) : e)),
});

export function addExercises(w: Workout, exerciseIds: string[], history: Workout[], makeId: MakeId): Workout {
  const added = exerciseIds.map((exerciseId, i) =>
    buildExercise(makeId, exerciseId, w.exercises.length + i, lastPerformance(history, exerciseId, w.templateId), null),
  );
  return { ...w, exercises: renumber([...w.exercises, ...added]) };
}

export function removeExercise(w: Workout, exId: string): Workout {
  return { ...w, exercises: renumber(normalizeSupersets(w.exercises.filter((e) => e.id !== exId))) };
}

/** Swaps the exercise for another one, keeping its place, rest time and number of sets; values and ticks are cleared. */
export function replaceExercise(w: Workout, exId: string, newExerciseId: string, history: Workout[], makeId: MakeId): Workout {
  return {
    ...w,
    exercises: w.exercises.map((e) => {
      if (e.id !== exId) return e;
      const fresh = buildExercise(makeId, newExerciseId, e.position, lastPerformance(history, newExerciseId, w.templateId), null);
      const sets = Array.from({ length: Math.max(1, e.sets.length) }, (_, i) => fresh.sets[i] ?? { ...blankSet(makeId(), i) });
      return { ...fresh, id: e.id, supersetId: e.supersetId, restSeconds: e.restSeconds, sets: renumberSets(sets) };
    }),
  };
}

export const reorderExercises = (w: Workout, ids: string[]): Workout => ({
  ...w,
  exercises: renumber(
    normalizeSupersets(ids.map((id) => w.exercises.find((e) => e.id === id)).filter((e): e is WorkoutExercise => !!e)),
  ),
});

export const linkNext = (w: Workout, exId: string, makeId: MakeId): Workout => ({
  ...w,
  exercises: renumber(linkWithNext(w.exercises, w.exercises.findIndex((e) => e.id === exId), makeId)),
});

export const unlink = (w: Workout, exId: string): Workout => ({
  ...w,
  exercises: renumber(unlinkExercise(w.exercises, w.exercises.findIndex((e) => e.id === exId))),
});

export const patchExercise = (w: Workout, exId: string, patch: Partial<Pick<WorkoutExercise, 'notes' | 'notesPinned' | 'restSeconds'>>): Workout =>
  mapExercise(w, exId, (e) => ({ ...e, ...patch }));

export const patchSet = (w: Workout, exId: string, setId: string, patch: Partial<Omit<WorkoutSet, 'id' | 'index'>>): Workout =>
  mapExercise(w, exId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));

/** Ticks or un-ticks a set; `completedAt` records when it was ticked. */
export function toggleSet(w: Workout, exId: string, setId: string, now: Date): Workout {
  return mapExercise(w, exId, (e) => ({
    ...e,
    sets: e.sets.map((s) =>
      s.id === setId ? { ...s, isCompleted: !s.isCompleted, completedAt: s.isCompleted ? null : now.toISOString() } : s,
    ),
  }));
}

/** New set below the last one, starting from its numbers (but never repeating a warm-up as a warm-up). */
export function addSet(w: Workout, exId: string, makeId: MakeId): Workout {
  return mapExercise(w, exId, (e) => {
    const last = e.sets[e.sets.length - 1];
    const next: WorkoutSet = {
      ...blankSet(makeId(), e.sets.length),
      weightKg: last?.weightKg ?? null,
      reps: last?.reps ?? null,
      durationSeconds: last?.durationSeconds ?? null,
      distanceMeters: last?.distanceMeters ?? null,
    };
    return { ...e, sets: [...e.sets, next] };
  });
}

export const removeSet = (w: Workout, exId: string, setId: string): Workout =>
  mapExercise(w, exId, (e) => ({ ...e, sets: renumberSets(e.sets.filter((s) => s.id !== setId)) }));

export function cycleSetType(w: Workout, exId: string, setId: string): Workout {
  return mapExercise(w, exId, (e) => ({
    ...e,
    sets: e.sets.map((s) => (s.id === setId ? { ...s, setType: SET_TYPES[(SET_TYPES.indexOf(s.setType) + 1) % SET_TYPES.length] as SetType } : s)),
  }));
}

/** Puts warm-up sets (weight × reps) at the top of the exercise and renumbers it. */
export function insertWarmups(w: Workout, exId: string, warmups: { weightKg: number; reps: number }[], makeId: MakeId): Workout {
  if (warmups.length === 0) return w;
  return mapExercise(w, exId, (e) => {
    const sets: WorkoutSet[] = warmups.map((x, i) => ({ ...blankSet(makeId(), i), setType: 'warmup', weightKg: x.weightKg, reps: x.reps }));
    return { ...e, sets: renumberSets([...sets, ...e.sets]) };
  });
}

/** Weight of the first working set of the exercise (what a warm-up ramp is based on), or null. */
export function workingWeightKg(e: Pick<WorkoutExercise, 'sets'>): number | null {
  const s = e.sets.find((x) => x.setType !== 'warmup' && (x.weightKg ?? 0) > 0);
  return s?.weightKg ?? null;
}

export const incompleteSetCount = (w: Pick<Workout, 'exercises'>) =>
  w.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.isCompleted).length, 0);

export const completedSets = (w: Pick<Workout, 'exercises'>) =>
  w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.isCompleted).length, 0);

/** Ticks every set that has something typed in (used by "finish anyway, count my numbers"). */
export function completeFilledSets(w: Workout, now: Date): Workout {
  const filled = (s: WorkoutSet) => (s.reps ?? 0) > 0 || (s.durationSeconds ?? 0) > 0 || (s.distanceMeters ?? 0) > 0;
  return {
    ...w,
    exercises: w.exercises.map((e) => ({
      ...e,
      sets: e.sets.map((s) => (!s.isCompleted && filled(s) ? { ...s, isCompleted: true, completedAt: now.toISOString() } : s)),
    })),
  };
}

/** Finished workout: unticked sets and empty exercises are dropped, the rest renumbered, `endedAt` set. */
export function finalizeWorkout(w: Workout, now: Date): Workout {
  const exercises = w.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.isCompleted) }))
    .filter((e) => e.sets.length > 0);
  return { ...w, endedAt: now.toISOString(), exercises: renumber(normalizeSupersets(exercises)) };
}
