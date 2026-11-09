import { sqliteMealScheduleRepo } from '@/data/sqliteRepository';
import { toKey } from '@/domain/date';
import { dueSchedules, mealFromTemplate } from '@/domain/mealSchedule';
import { useMealStore } from '@/store/useMealStore';
import { newId } from '@/domain/id';


let running: Promise<void> | null = null;

/**
 * Logs every scheduled meal whose time has passed today and that wasn't logged yet. Runs on launch, on return
 * to the foreground and every minute while open (iOS can't run code while the app is closed).
 * Each schedule is claimed in the DB first, so concurrent runs can't double-log and a meal you delete
 * is not logged again the same day.
 */
export function runMealSchedules(): Promise<void> {
  running ??= (async () => {
    try {
      const store = useMealStore.getState();
      const now = new Date();
      const today = toKey(now);
      for (const s of dueSchedules(store.schedules, now)) {
        const tpl = store.saved.find((m) => m.id === s.savedMealId);
        if (!tpl) continue;
        if (!(await sqliteMealScheduleRepo.claim(s.id, today))) continue;
        try {
          await useMealStore.getState().add(mealFromTemplate(tpl, s, now, newId(), 'Auto-logged from a schedule.'));
          useMealStore.setState({
            schedules: useMealStore.getState().schedules.map((x) => (x.id === s.id ? { ...x, lastApplied: today } : x)),
          });
        } catch (e) {
          await sqliteMealScheduleRepo.release(s.id, s.lastApplied).catch(() => {});
          throw e;
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('Meal schedule run failed', e);
    }
  })().finally(() => {
    running = null;
  });
  return running;
}
