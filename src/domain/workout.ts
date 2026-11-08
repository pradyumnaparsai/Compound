// Workout tracking domain: types and pure rules (volume, 1RM, set labels, supersets).
// "Routine" is already the daily-habit concept in this app, so a planned session is a WorkoutTemplate.
// All weights are stored in kg; `weightKg` is signed for assisted exercises (negative = assistance).

export const SET_TYPES = ['normal', 'warmup', 'dropset', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];
export const isSetType = (v: unknown): v is SetType => (SET_TYPES as readonly unknown[]).includes(v);

export const EXERCISE_TYPES = [
  'weight_reps',
  'bodyweight_reps',
  'bodyweight_assisted_reps',
  'weight_duration',
  'duration',
  'reps_only',
  'distance_duration',
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];
export const isExerciseType = (v: unknown): v is ExerciseType => (EXERCISE_TYPES as readonly unknown[]).includes(v);

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Weight & reps',
  bodyweight_reps: 'Bodyweight reps',
  bodyweight_assisted_reps: 'Assisted bodyweight',
  weight_duration: 'Weight & duration',
  duration: 'Duration',
  reps_only: 'Reps only',
  distance_duration: 'Distance & duration',
};

export const MUSCLES = [
  'chest', 'lats', 'upper_back', 'lower_back', 'shoulders', 'traps', 'biceps', 'triceps', 'forearms',
  'abs', 'quads', 'hamstrings', 'glutes', 'calves', 'full_body', 'cardio', 'other',
] as const;
export type Muscle = (typeof MUSCLES)[number];
export const isMuscle = (v: unknown): v is Muscle => (MUSCLES as readonly unknown[]).includes(v);

export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other'] as const;
export type Equipment = (typeof EQUIPMENT)[number];
export const isEquipment = (v: unknown): v is Equipment => (EQUIPMENT as readonly unknown[]).includes(v);

/** "upper_back" → "Upper back". */
export const humanize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ');

export type ExerciseDef = {
  id: string;
  title: string;
  type: ExerciseType;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  /** False for the built-in catalog (kept in code), true for user-made or imported exercises (kept in SQLite). */
  isCustom: boolean;
};

export type WorkoutSet = {
  id: string;
  index: number;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  rpe: number | null;
  isCompleted: boolean;
  completedAt: string | null;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  position: number;
  /** Exercises sharing a non-null id form one superset (adjacent in `position` order). */
  supersetId: string | null;
  restSeconds: number | null;
  notes: string;
  /** Pinned notes are copied forward every time the exercise is logged. */
  notesPinned: boolean;
  sets: WorkoutSet[];
};

export type Workout = {
  id: string;
  title: string;
  templateId: string | null;
  startedAt: string;
  endedAt: string | null;
  /** Local YYYY-MM-DD the workout started on (what the calendar uses). */
  date: string;
  notes: string;
  exercises: WorkoutExercise[];
};

export type TemplateSet = {
  id: string;
  index: number;
  setType: SetType;
  repMin: number | null;
  repMax: number | null;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
};

export type TemplateExercise = Omit<WorkoutExercise, 'sets'> & { sets: TemplateSet[] };

export type WorkoutTemplate = {
  id: string;
  title: string;
  notes: string;
  folderId: string | null;
  position: number;
  exercises: TemplateExercise[];
};

export type WorkoutFolder = { id: string; title: string; position: number };

export const DEFAULT_REST_SECONDS = 90;
/** Rest durations the rest chip cycles through (0 = no timer). */
export const REST_PRESETS = [0, 30, 45, 60, 90, 120, 180, 240, 300];

/** Which inputs a set row shows for an exercise type. */
export type SetFields = { weight: boolean; reps: boolean; duration: boolean; distance: boolean };
export function setFields(type: ExerciseType): SetFields {
  switch (type) {
    case 'weight_reps':
      return { weight: true, reps: true, duration: false, distance: false };
    case 'bodyweight_reps':
    case 'bodyweight_assisted_reps':
      return { weight: true, reps: true, duration: false, distance: false }; // weight = added / assist
    case 'weight_duration':
      return { weight: true, reps: false, duration: true, distance: false };
    case 'duration':
      return { weight: false, reps: false, duration: true, distance: false };
    case 'reps_only':
      return { weight: false, reps: true, duration: false, distance: false };
    case 'distance_duration':
      return { weight: false, reps: false, duration: true, distance: true };
  }
}

export const SET_TYPE_HINTS: Record<SetType, string> = {
  normal: 'A regular working set.',
  warmup: 'Warm-up: skipped for PRs and, by default, for volume.',
  dropset: 'Drop set: reduce the weight and keep going right after the last set.',
  failure: 'Failure: taken until no more good-form reps are possible.',
};

const nz = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/** Epley estimated one-rep max: w × (1 + reps/30). 0 when there is no load or no reps. */
export function epley1RM(weightKg: number, reps: number): number {
  if (!(weightKg > 0) || !(reps > 0)) return 0;
  return weightKg * (1 + reps / 30);
}

/**
 * Display labels for a list of sets: normal sets are numbered 1, 2, 3 (warm-ups and others do not consume
 * a number), the rest show W, D or F.
 */
export function setLabels(sets: Pick<WorkoutSet, 'setType'>[]): string[] {
  let n = 0;
  return sets.map((s) => {
    switch (s.setType) {
      case 'warmup':
        return 'W';
      case 'dropset':
        return 'D';
      case 'failure':
        return 'F';
      default:
        return String(++n);
    }
  });
}

export type VolumeOptions = {
  includeWarmup?: boolean;
  /** Latest body weight (kg); needed to count bodyweight and assisted exercises. Without it they count added weight only (assisted counts 0). */
  bodyweightKg?: number | null;
};

/** Load (kg) moved per rep for one set, by exercise type. */
export function effectiveLoadKg(weightKg: number | null, type: ExerciseType, bodyweightKg?: number | null): number {
  const w = nz(weightKg);
  switch (type) {
    case 'weight_reps':
    case 'weight_duration':
      return Math.max(0, w);
    case 'bodyweight_reps':
      return Math.max(0, nz(bodyweightKg) + w);
    case 'bodyweight_assisted_reps':
      // weightKg is negative assistance; without a body weight the load is unknown.
      return bodyweightKg ? Math.max(0, bodyweightKg + Math.min(0, w)) : 0;
    default:
      return 0;
  }
}

/** Volume (kg × reps) of one set; only completed sets with reps count. Duration/reps-only types have none. */
export function setVolume(
  set: Pick<WorkoutSet, 'setType' | 'weightKg' | 'reps' | 'isCompleted'>,
  type: ExerciseType,
  opts: VolumeOptions = {},
): number {
  if (!set.isCompleted) return 0;
  if (set.setType === 'warmup' && !opts.includeWarmup) return 0;
  if (type === 'weight_duration' || type === 'duration' || type === 'reps_only' || type === 'distance_duration') return 0;
  return effectiveLoadKg(set.weightKg, type, opts.bodyweightKg) * nz(set.reps);
}

export function exerciseVolume(
  ex: Pick<WorkoutExercise, 'sets'>,
  type: ExerciseType,
  opts: VolumeOptions = {},
): number {
  return ex.sets.reduce((sum, s) => sum + setVolume(s, type, opts), 0);
}

/** `typeOf` resolves an exercise id to its type (unknown ids count as weight_reps). */
export function workoutVolume(
  w: Pick<Workout, 'exercises'>,
  typeOf: (exerciseId: string) => ExerciseType | undefined,
  opts: VolumeOptions = {},
): number {
  return w.exercises.reduce((sum, e) => sum + exerciseVolume(e, typeOf(e.exerciseId) ?? 'weight_reps', opts), 0);
}

export const completedSetCount = (w: Pick<Workout, 'exercises'>, includeWarmup = true) =>
  w.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.isCompleted && (includeWarmup || s.setType !== 'warmup')).length,
    0,
  );

export const workoutDurationSeconds = (w: Pick<Workout, 'startedAt' | 'endedAt'>, now: Date = new Date()): number => {
  const end = w.endedAt ? new Date(w.endedAt).getTime() : now.getTime();
  return Math.max(0, Math.round((end - new Date(w.startedAt).getTime()) / 1000));
};

/** "1:05:09" or "12:30". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Typo guard: a message when a value is implausible for a single set, otherwise null. */
export function setWarning(
  set: Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSeconds' | 'distanceMeters'>,
): string | null {
  if (nz(set.weightKg) > 600) return 'That weight looks very high. Check for a typo.';
  if (nz(set.weightKg) < -300) return 'That assistance looks very high. Check for a typo.';
  if (nz(set.reps) > 200) return 'That many reps looks like a typo.';
  if (nz(set.durationSeconds) > 6 * 3600) return 'That duration is over 6 hours. Check for a typo.';
  if (nz(set.distanceMeters) > 200_000) return 'That distance is over 200 km. Check for a typo.';
  return null;
}

// ── Supersets ─────────────────────────────────────────────────────────────

/** Consecutive exercises with the same supersetId are one group; every other exercise is its own group. */
export function groupBySuperset<T extends { supersetId: string | null }>(exercises: T[]): T[][] {
  const groups: T[][] = [];
  for (const e of exercises) {
    const last = groups[groups.length - 1];
    if (e.supersetId && last && last[0].supersetId === e.supersetId) last.push(e);
    else groups.push([e]);
  }
  return groups;
}

/**
 * Repairs supersets after any edit: a group must be contiguous and have at least two members.
 * A split group keeps its id on the first run; later runs get `${id}~${n}`; singletons are cleared.
 */
export function normalizeSupersets<T extends { supersetId: string | null }>(exercises: T[]): T[] {
  const out = exercises.map((e) => ({ ...e }));
  const seen = new Map<string, number>();
  let i = 0;
  while (i < out.length) {
    const id = out[i].supersetId;
    if (!id) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < out.length && out[j + 1].supersetId === id) j++;
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    const finalId = n === 0 ? id : `${id}~${n}`;
    for (let k = i; k <= j; k++) out[k].supersetId = j > i ? finalId : null;
    i = j + 1;
  }
  return out;
}

/** Links the exercise at `index` with the one after it (joining an existing group when present). */
export function linkWithNext<T extends { supersetId: string | null }>(exercises: T[], index: number, makeId: () => string): T[] {
  if (index < 0 || index >= exercises.length - 1) return exercises;
  const id = exercises[index].supersetId ?? exercises[index + 1].supersetId ?? makeId();
  return normalizeSupersets(exercises.map((e, i) => (i === index || i === index + 1 ? { ...e, supersetId: id } : e)));
}

/** Removes the exercise at `index` from its superset (the group dissolves if one member is left). */
export function unlinkExercise<T extends { supersetId: string | null }>(exercises: T[], index: number): T[] {
  if (!exercises[index]?.supersetId) return exercises;
  return normalizeSupersets(exercises.map((e, i) => (i === index ? { ...e, supersetId: null } : e)));
}

/** Letter badge for supersets in display order: A, B, ... for each group of 2+ (null for solo exercises). */
export function supersetBadges(exercises: { supersetId: string | null }[]): (string | null)[] {
  const letters = new Map<string, string>();
  return exercises.map((e) => {
    if (!e.supersetId) return null;
    if (!letters.has(e.supersetId)) letters.set(e.supersetId, String.fromCharCode(65 + (letters.size % 26)));
    return letters.get(e.supersetId)!;
  });
}

/** Re-numbers `position` / `index` so they are 0..n-1 in array order. */
export function renumber<E extends { position: number; sets: { index: number }[] }>(exercises: E[]): E[] {
  return exercises.map((e, i) => ({ ...e, position: i, sets: e.sets.map((s, k) => ({ ...s, index: k })) }));
}

/** Re-numbers `index` so a list of sets is 0..n-1 in array order. */
export const renumberSets = <S extends { index: number }>(sets: S[]): S[] => sets.map((s, i) => ({ ...s, index: i }));
