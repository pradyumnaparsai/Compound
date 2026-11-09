// Personal records and progress per exercise. Warm-up sets never count; unfinished sets never count.
import { epley1RM, effectiveLoadKg, type ExerciseType, type Workout, type WorkoutSet } from './workout';

export type RecordKind = 'weight' | 'oneRM' | 'reps' | 'setVolume' | 'duration' | 'distance';

export type PR = { exerciseId: string; setId: string; kind: RecordKind; value: number };

const nz = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
const counts = (s: WorkoutSet) => s.isCompleted && s.setType !== 'warmup';

type Candidate = { setId: string; value: number };

/** Record kinds that apply to an exercise type. */
function kindsFor(type: ExerciseType): RecordKind[] {
  switch (type) {
    case 'weight_reps':
    case 'bodyweight_reps':
    case 'bodyweight_assisted_reps':
      return ['weight', 'oneRM', 'reps', 'setVolume'];
    case 'reps_only':
      return ['reps'];
    case 'weight_duration':
      return ['weight', 'duration'];
    case 'duration':
      return ['duration'];
    case 'distance_duration':
      return ['distance', 'duration'];
  }
}

const setValue = (s: WorkoutSet, kind: RecordKind, type: ExerciseType): number => {
  switch (kind) {
    case 'weight':
      return s.weightKg ?? 0;
    case 'oneRM':
      return epley1RM(s.weightKg ?? 0, nz(s.reps));
    case 'reps':
      return nz(s.reps);
    case 'setVolume':
      return effectiveLoadKg(s.weightKg, type) * nz(s.reps);
    case 'duration':
      return nz(s.durationSeconds);
    case 'distance':
      return nz(s.distanceMeters);
  }
};

function setsOf(workouts: Workout[], exerciseId: string): WorkoutSet[] {
  return workouts.flatMap((w) => w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter(counts)));
}

/** Best previous value for a kind, or null when the exercise has no prior counted sets (nothing to beat). */
function priorBest(prior: WorkoutSet[], kind: RecordKind, type: ExerciseType): number | null {
  let best: number | null = null;
  for (const s of prior) {
    const v = setValue(s, kind, type);
    if (v > 0 && (best === null || v > best)) best = v;
  }
  return best;
}

/**
 * PRs set by `current` against `history` (workouts finished earlier; `current` itself is ignored if present).
 * An exercise with no history has no PRs. Within one workout each kind is awarded once, to its best set.
 * "reps" is judged at a weight: reps must beat every previous set at that weight or heavier.
 */
export function detectPRs(history: Workout[], current: Workout, typeOf: (exerciseId: string) => ExerciseType | undefined): PR[] {
  const prior = history.filter((w) => w.id !== current.id);
  const out: PR[] = [];
  const exerciseIds = [...new Set(current.exercises.map((e) => e.exerciseId))];
  for (const exerciseId of exerciseIds) {
    const type = typeOf(exerciseId) ?? 'weight_reps';
    const before = setsOf(prior, exerciseId);
    if (before.length === 0) continue;
    const now = current.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter(counts));
    for (const kind of kindsFor(type)) {
      let best: Candidate | null = null;
      for (const s of now) {
        const v = setValue(s, kind, type);
        if (v > 0 && (!best || v > best.value)) best = { setId: s.id, value: v };
      }
      if (!best) continue;
      if (kind === 'reps' && type !== 'reps_only') {
        // Most reps at a weight: any set that out-reps all previous sets at that weight or heavier.
        for (const s of now) {
          const reps = nz(s.reps);
          const w = s.weightKg ?? 0;
          if (reps <= 0) continue;
          const beaten = before.filter((b) => (b.weightKg ?? 0) >= w).every((b) => nz(b.reps) < reps);
          const bestAtThisWeight = now.every((o) => (o.weightKg ?? 0) !== w || nz(o.reps) <= reps);
          if (beaten && bestAtThisWeight && !out.some((p) => p.setId === s.id && p.kind === 'reps')) {
            out.push({ exerciseId, setId: s.id, kind, value: reps });
          }
        }
        continue;
      }
      const prev = priorBest(before, kind, type);
      if (prev !== null && best.value > prev) out.push({ exerciseId, setId: best.setId, kind, value: best.value });
    }
  }
  return out;
}

export const RECORD_LABELS: Record<RecordKind, string> = {
  weight: 'Heaviest weight',
  oneRM: 'Best 1RM',
  reps: 'Most reps',
  setVolume: 'Best set volume',
  duration: 'Longest duration',
  distance: 'Longest distance',
};

export type ProgressPoint = { date: string; bestWeightKg: number; best1RM: number; volume: number };

/** One point per workout date for an exercise: heaviest set, best estimated 1RM and total volume (warm-ups excluded). */
export function exerciseProgress(workouts: Workout[], exerciseId: string, type: ExerciseType): ProgressPoint[] {
  const byDate = new Map<string, ProgressPoint>();
  for (const w of [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    for (const e of w.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      for (const s of e.sets.filter(counts)) {
        const p = byDate.get(w.date) ?? { date: w.date, bestWeightKg: 0, best1RM: 0, volume: 0 };
        p.bestWeightKg = Math.max(p.bestWeightKg, s.weightKg ?? 0);
        p.best1RM = Math.max(p.best1RM, epley1RM(s.weightKg ?? 0, nz(s.reps)));
        p.volume += effectiveLoadKg(s.weightKg, type) * nz(s.reps);
        byDate.set(w.date, p);
      }
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
