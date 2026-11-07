import { toKey } from './date';
import { slotForTime, totalsOf, type Meal, type MealSlot, type SavedMeal } from './meal';

/** Auto-logs a saved meal at a time of day. `days`: 0 = Sunday … 6 = Saturday; null = every day. */
export type MealSchedule = {
  id: string;
  savedMealId: string;
  time: string; // 'HH:mm', 24 h, device-local
  days: number[] | null;
  enabled: boolean;
  createdAt: string; // ISO timestamp; occurrences before this instant are never logged
  lastApplied: string | null; // date key of the last day it was auto-logged
};

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Accepts '8', '8:5', '08:05', '0805', '8.30'. Returns normalized 'HH:mm' or null. */
export function parseTime(raw: string): string | null {
  const s = raw.trim();
  let h: string;
  let m: string;
  const sep = /^(\d{1,2})[:.](\d{1,2})$/.exec(s);
  if (sep) {
    [, h, m] = sep;
  } else if (/^\d{3,4}$/.test(s)) {
    h = s.slice(0, -2);
    m = s.slice(-2);
  } else if (/^\d{1,2}$/.test(s)) {
    h = s;
    m = '0';
  } else {
    return null;
  }
  const hh = Number(h);
  const mm = Number(m);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** 'HH:mm' → '8:00 AM'. */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 'Every day' / 'Mon, Wed, Fri'. */
export function formatDays(days: number[] | null): string {
  if (!days || days.length === 0 || days.length === 7) return 'Every day';
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[d]).join(', ');
}

/** The moment the schedule fires on the day of `date` (device-local). */
export function occurrenceAt(time: string, date: Date): Date {
  const [h, m] = time.split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);
}

/**
 * Schedules that should be logged right now: enabled, today is one of their days, the time has passed,
 * not already applied today, and the occurrence is not before the schedule was created (so adding a
 * schedule at 10:00 for 08:00 starts tomorrow instead of logging immediately).
 * Only today is ever considered: days the app was never opened are skipped on purpose.
 */
export function dueSchedules(schedules: MealSchedule[], now: Date): MealSchedule[] {
  const today = toKey(now);
  return schedules.filter((s) => {
    if (!s.enabled || s.lastApplied === today) return false;
    if (s.days && s.days.length > 0 && !s.days.includes(now.getDay())) return false;
    const at = occurrenceAt(s.time, now);
    return at.getTime() <= now.getTime() && at.getTime() >= new Date(s.createdAt).getTime();
  });
}

/**
 * Applies an edit. When the time or days change, the schedule restarts from its next occurrence (`createdAt` = now),
 * so moving 08:00 to 09:00 at 10:00 doesn't log the meal immediately.
 */
export function editSchedule(
  s: MealSchedule,
  next: { time: string; days: number[] | null },
  nowIso: string,
): MealSchedule {
  const norm = (d: number[] | null) => (d && d.length > 0 && d.length < 7 ? [...d].sort((a, b) => a - b).join(',') : '');
  const changed = s.time !== next.time || norm(s.days) !== norm(next.days) || !s.enabled;
  return { ...s, ...next, enabled: true, createdAt: changed ? nowIso : s.createdAt };
}

/** Builds the diary entry for an auto-logged template, stamped at the scheduled time. */
export function mealFromTemplate(
  tpl: SavedMeal,
  schedule: Pick<MealSchedule, 'time'>,
  now: Date,
  id: string,
  assumption: string,
): Meal {
  const at = occurrenceAt(schedule.time, now);
  const t = totalsOf(tpl.ingredients);
  const slot: MealSlot = slotForTime(at);
  return {
    id,
    date: toKey(at),
    slot,
    loggedAt: at.toISOString(),
    title: tpl.title,
    inputType: 'saved',
    confidence: 10,
    ingredients: tpl.ingredients,
    calories: t.calories,
    proteinG: t.proteinG,
    carbsG: t.carbsG,
    fatG: t.fatG,
    assumptions: [assumption],
  };
}

/** Builds a template from builder items (totals recomputed from the items). */
export function templateFromItems(
  base: { id: string; createdAt: string },
  title: string,
  ingredients: SavedMeal['ingredients'],
): SavedMeal {
  const t = totalsOf(ingredients);
  return {
    id: base.id,
    title: title.trim().slice(0, 40) || 'Meal',
    ingredients,
    calories: t.calories,
    proteinG: t.proteinG,
    carbsG: t.carbsG,
    fatG: t.fatG,
    createdAt: base.createdAt,
  };
}
