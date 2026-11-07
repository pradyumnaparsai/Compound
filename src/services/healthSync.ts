import { addDays, todayKey } from '@/domain/date';
import { isScheduled } from '@/domain/recurrence';
import { getDailySteps, getWorkoutCounts } from '@/services/health';
import { useHealthStore } from '@/store/useHealthStore';
import { useRoutineStore } from '@/store/useRoutineStore';

const BACKFILL_DAYS = 7; // the app may not be opened every day

let running = false;

/** Reads Apple Health and auto-checks goal routines whose goal was met. Adds completions only. */
export async function refreshHealth(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { routines, ready, autoComplete } = useRoutineStore.getState();
    if (!ready) return;
    const goals = routines.filter((r) => (r.goal?.type === 'steps' || r.goal?.type === 'workout') && !r.archivedAt);
    if (goals.length === 0) return;

    const today = todayKey();
    const earliest = goals.map((r) => r.createdAt).sort()[0];
    const from = earliest > addDays(today, -BACKFILL_DAYS) ? earliest : addDays(today, -BACKFILL_DAYS);

    const needSteps = goals.some((r) => r.goal?.type === 'steps');
    const needWorkouts = goals.some((r) => r.goal?.type === 'workout');
    const [steps, workouts] = await Promise.all([
      needSteps ? getDailySteps(from, today) : Promise.resolve(null),
      needWorkouts ? getWorkoutCounts(from, today) : Promise.resolve(null),
    ]);
    if (!steps && !workouts) return;
    useHealthStore.getState().merge({ steps: steps ?? undefined, workouts: workouts ?? undefined });

    const items: { routineId: string; date: string }[] = [];
    for (let d = from; d <= today; d = addDays(d, 1)) {
      for (const r of goals) {
        if (!r.goal || !isScheduled(r, d)) continue;
        const met =
          r.goal.type === 'steps' ? (steps?.[d] ?? 0) >= r.goal.target : (workouts?.[d] ?? 0) > 0;
        if (met) items.push({ routineId: r.id, date: d });
      }
    }
    await autoComplete(items);
  } catch (e) {
    if (__DEV__) console.warn('Health refresh failed', e);
  } finally {
    running = false;
  }
}
