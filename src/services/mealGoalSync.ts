import { addDays, todayKey } from '@/domain/date';
import { isScheduled } from '@/domain/recurrence';
import { useMealStore } from '@/store/useMealStore';
import { useRoutineStore } from '@/store/useRoutineStore';

const BACKFILL_DAYS = 7;

/** Auto-checks protein-goal routines for days whose logged protein reached the target. Adds completions only. */
export async function refreshMealGoals(): Promise<void> {
  try {
    const { routines, ready, autoComplete } = useRoutineStore.getState();
    if (!ready) return;
    const goals = routines.filter((r) => r.goal?.type === 'protein' && !r.archivedAt);
    if (goals.length === 0) return;

    const today = todayKey();
    const from = addDays(today, -BACKFILL_DAYS);
    const protein = new Map<string, number>();
    for (const m of useMealStore.getState().meals) {
      if (m.date >= from && m.date <= today) protein.set(m.date, (protein.get(m.date) ?? 0) + m.proteinG);
    }

    const items: { routineId: string; date: string }[] = [];
    for (let d = from; d <= today; d = addDays(d, 1)) {
      for (const r of goals) {
        if (d < r.createdAt || !r.goal || r.goal.type !== 'protein' || !isScheduled(r, d)) continue;
        if ((protein.get(d) ?? 0) >= r.goal.target) items.push({ routineId: r.id, date: d });
      }
    }
    await autoComplete(items);
  } catch (e) {
    if (__DEV__) console.warn('Meal goal refresh failed', e);
  }
}
