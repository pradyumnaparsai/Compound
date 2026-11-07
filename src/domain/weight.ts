import { addDays, fromKey, toKey, weekday } from './date';

export type WeightEntry = { date: string; kg: number };
export type WeeklyAverage = { weekStart: string; avg: number; count: number };

/** Sunday-first week start, consistent with the calendar. */
export const weekStart = (date: string) => addDays(date, -weekday(date));

/** Average per week for the last `weeks` weeks (oldest → newest); weeks with no entries are skipped. */
export function weeklyAverages(entries: WeightEntry[], today: string, weeks = 12): WeeklyAverage[] {
  const firstWeek = addDays(weekStart(today), -7 * (weeks - 1));
  const buckets = new Map<string, number[]>();
  for (const e of entries) {
    const w = weekStart(e.date);
    if (w < firstWeek) continue;
    buckets.set(w, [...(buckets.get(w) ?? []), e.kg]);
  }
  const out: WeeklyAverage[] = [];
  for (let i = 0; i < weeks; i++) {
    const w = addDays(firstWeek, 7 * i);
    const vals = buckets.get(w);
    if (vals?.length) {
      out.push({ weekStart: w, avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length });
    }
  }
  return out;
}

export const formatWeekLabel = (key: string) => {
  const d = fromKey(key);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

export { toKey };
