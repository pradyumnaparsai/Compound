import { countsAsStrengthSession, workoutGoalCompletions } from '@/domain/strength';
import type { Workout } from '@/domain/workout';
import { saveStrengthWorkout } from '@/services/health';
import { useHealthStore } from '@/store/useHealthStore';
import { useRoutineStore } from '@/store/useRoutineStore';

/**
 * A live workout was finished and saved. If it came from a template: write a Traditional Strength Training workout to
 * Apple Health with the real start and end, and tick the "strength workout" routines for that day.
 * Never throws: the workout itself is already saved.
 */
export async function onLiveWorkoutFinished(w: Workout): Promise<void> {
  if (!countsAsStrengthSession(w) || !w.endedAt) return;
  try {
    const saved = await saveStrengthWorkout(new Date(w.startedAt), new Date(w.endedAt));
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
