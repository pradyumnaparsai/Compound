import { detectPRs, type PR } from './records';
import {
  completedSetCount,
  workoutDurationSeconds,
  workoutVolume,
  type ExerciseType,
  type VolumeOptions,
  type Workout,
} from './workout';

export type WorkoutSummary = {
  durationSeconds: number;
  volumeKg: number;
  setCount: number;
  exerciseCount: number;
  prs: PR[];
};

/**
 * Totals for a workout and the PRs it set. `history` may contain any workouts of the same exercises; only those
 * that started earlier count as "before" (so an old workout is judged against its own past, not today's lifts).
 */
export function summarize(
  w: Workout,
  history: Workout[],
  typeOf: (exerciseId: string) => ExerciseType | undefined,
  opts: VolumeOptions = {},
  now: Date = new Date(),
): WorkoutSummary {
  const before = history.filter((h) => h.id !== w.id && h.startedAt < w.startedAt);
  return {
    durationSeconds: workoutDurationSeconds(w, now),
    volumeKg: workoutVolume(w, typeOf, opts),
    setCount: completedSetCount(w, !!opts.includeWarmup),
    exerciseCount: w.exercises.filter((e) => e.sets.some((s) => s.isCompleted)).length,
    prs: detectPRs(before, w, typeOf),
  };
}
