import { countsAsStrengthSession, workoutGoalCompletions } from '@/domain/strength';
import type { Workout } from '@/domain/workout';
import {
  discardLiveStrengthSession,
  finishLiveStrengthSession,
  nudgeWatchStrengthWorkout,
  saveStrengthWorkout,
  startLiveStrengthSession,
} from '@/services/health';
import { useHealthStore } from '@/store/useHealthStore';
import { useRoutineStore } from '@/store/useRoutineStore';

/**
 * A template workout has started: start a live Traditional Strength Training session on the iPhone and ask the Watch to
 * start one too. Best effort, never throws.
 */
export function onTemplateWorkoutStarted(startedAt: Date = new Date()): void {
  void bestEffort(() => startLiveStrengthSession(startedAt));
  void bestEffort(nudgeWatchStrengthWorkout); // only does anything with a watchOS companion app
}
const bestEffort = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch {
    /* unsupported device or no Watch app: nothing to do */
  }
};

/** A live workout was cancelled: end the live session without saving it to Health. Never throws. */
export async function onLiveWorkoutDiscarded(): Promise<void> {
  await bestEffort(discardLiveStrengthSession);
}

/**
 * A live workout was finished and saved. If it came from a template: write a Traditional Strength Training workout to
 * Apple Health with the real start and end, and tick the "strength workout" routines for that day.
 * Never throws: the workout itself is already saved.
 */
export async function onLiveWorkoutFinished(w: Workout): Promise<void> {
  if (!countsAsStrengthSession(w) || !w.endedAt) {
    await onLiveWorkoutDiscarded(); // nothing worth recording: stop the live session without saving
    return;
  }
  try {
    // The live session writes the workout itself; only write one by hand when there was no session (older iOS, app restarted).
    const end = new Date(w.endedAt);
    const saved = (await finishLiveStrengthSession(end)) || (await saveStrengthWorkout(new Date(w.startedAt), end));
    if (saved) {
      const counts = useHealthStore.getState().workouts;
      useHealthStore.getState().merge({ workouts: { [w.date]: (counts[w.date] ?? 0) + 1 } });
    }
  } catch (e) {
    if (__DEV__) console.warn('Health sync of finished workout failed', e);
  }
  try {
    const { routines, autoComplete } = useRoutineStore.getState();
    await autoComplete(workoutGoalCompletions(routines, w.date));
  } catch (e) {
    if (__DEV__) console.warn('Ticking strength routines failed', e);
  }
}
