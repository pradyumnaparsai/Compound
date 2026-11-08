// When a finished workout counts as a strength session (Apple Health entry + routine goal tick).
import { isScheduled } from './recurrence';
import type { Routine } from './types';
import type { Workout } from './workout';

/** Only workouts started from a template, with at least one logged set, count. Edited and imported ones never do. */
export const countsAsStrengthSession = (w: Pick<Workout, 'templateId' | 'exercises'>): boolean =>
  !!w.templateId && w.exercises.some((e) => e.sets.some((s) => s.isCompleted));

/** Routines with the "strength workout" goal that are scheduled (and not archived) on `date`. */
export function workoutGoalCompletions(routines: Routine[], date: string): { routineId: string; date: string }[] {
  return routines
    .filter((r) => r.goal?.type === 'workout' && !r.archivedAt && isScheduled(r, date))
    .map((r) => ({ routineId: r.id, date }));
}
