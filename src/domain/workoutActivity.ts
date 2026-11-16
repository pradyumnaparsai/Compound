// What the lock-screen / Dynamic Island "workout in progress" Live Activity shows. Pure: no native calls here.
import { completedSets } from './session';
import type { Workout } from './workout';

export type WorkoutActivityProps = {
  title: string;
  /** Epoch ms the workout started; the system draws the running clock from it, so it needs no updates. */
  startedAt: number;
  setsDone: number;
  setsTotal: number;
};

/** Live Activity content for a workout being logged; null when there is nothing live (no workout, or finished). */
export function workoutActivityProps(w: Workout | null | undefined): WorkoutActivityProps | null {
  if (!w || w.endedAt) return null;
  const startedAt = Date.parse(w.startedAt);
  return {
    title: w.title.trim() || 'Workout',
    startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
    setsDone: completedSets(w),
    setsTotal: w.exercises.reduce((n, e) => n + e.sets.length, 0),
  };
}

/** Two props describe the same on-screen content (so a store change that doesn't alter them is not pushed again). */
export const sameActivityProps = (a: WorkoutActivityProps | null, b: WorkoutActivityProps | null) =>
  a === b || (!!a && !!b && a.title === b.title && a.startedAt === b.startedAt && a.setsDone === b.setsDone && a.setsTotal === b.setsTotal);
