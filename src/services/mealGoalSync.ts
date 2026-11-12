import { sqliteSettingsRepo } from '@/data/sqliteRepository';
import { addDays, todayKey } from '@/domain/date';
import { defaultMealRoutine, mealGoalDoneToday, mealGoalMet } from '@/domain/goal';
import { isScheduled } from '@/domain/recurrence';
import { useMealStore } from '@/store/useMealStore';
import { useRoutineStore } from '@/store/useRoutineStore';

const BACKFILL_DAYS = 7;

/**
 * Auto-checks meal-based routines. Adds completions only.
 * - 'protein': checked as soon as the day's logged protein reaches the target.
 * - 'meal': today is checked as soon as calories and protein both reach the targets, or from 9 PM if within the
 *   slack (overeating is logged to the next day); past days are judged with the slack.
 */
export async function refreshMealGoals(): Promise<void> {
  try {
    const { routines, ready, autoComplete } = useRoutineStore.getState();
    if (!ready) return;
    const goals = routines.filter((r) => (r.goal?.type === 'protein' || r.goal?.type === 'meal') && !r.archivedAt);
    if (goals.length === 0) return;

    const today = todayKey();
    const hour = new Date().getHours();
    const from = addDays(today, -BACKFILL_DAYS);
    const totals = new Map<string, { calories: number; proteinG: number }>();
    for (const m of useMealStore.getState().meals) {
      if (m.date < from || m.date > today) continue;
      const t = totals.get(m.date) ?? { calories: 0, proteinG: 0 };
      t.calories += m.calories;
      t.proteinG += m.proteinG;
      totals.set(m.date, t);
    }

    const items: { routineId: string; date: string }[] = [];
    for (let d = from; d <= today; d = addDays(d, 1)) {
      const day = totals.get(d) ?? { calories: 0, proteinG: 0 };
      for (const r of goals) {
        if (!r.goal || !isScheduled(r, d)) continue; // isScheduled also excludes days before creation
        if (r.goal.type === 'protein') {
          if (day.proteinG >= r.goal.target) items.push({ routineId: r.id, date: d });
        } else if (r.goal.type === 'meal') {
          const ok = d < today ? mealGoalMet(r.goal, day) : mealGoalDoneToday(r.goal, day, hour);
          if (ok) items.push({ routineId: r.id, date: d });
        }
      }
    }
    await autoComplete(items);
  } catch (e) {
    if (__DEV__) console.warn('Meal goal refresh failed', e);
  }
}

const SEEDED_FLAG = 'default_meal_goal';
let seeding: Promise<void> | null = null;

/**
 * Creates the everyday meal-goal routine once, from the Meals goals. Does nothing until Meals goals are set,
 * and never recreates it after the first time (so deleting it sticks).
 */
export function ensureDefaultMealGoal(): Promise<void> {
  seeding ??= (async () => {
    try {
      const { routines, ready, addRoutine } = useRoutineStore.getState();
      if (!ready || (await sqliteSettingsRepo.getFlag(SEEDED_FLAG))) return;
      if (!routines.some((r) => r.goal?.type === 'meal')) {
        const goals = await sqliteSettingsRepo.getGoals();
        if (!goals) return;
        await addRoutine(defaultMealRoutine(goals));
      }
      await sqliteSettingsRepo.setFlag(SEEDED_FLAG);
    } catch (e) {
      if (__DEV__) console.warn('Default meal goal failed', e);
    }
  })().finally(() => {
    seeding = null;
  });
  return seeding;
}
