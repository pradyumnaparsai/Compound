import { addDays, todayKey, weekday } from './date';
import type { Completion, DayStatus, Routine } from './types';

/** Occurrences are computed from the rule; only completions are stored. */
export function isScheduled(r: Routine, date: string): boolean {
  if (date < r.createdAt) return false;
  if (r.archivedAt && date >= r.archivedAt) return false;
  if (r.recurrence.type === 'daily') return true;
  return r.recurrence.days.includes(weekday(date));
}

export function scheduledOn(routines: Routine[], date: string): Routine[] {
  return routines.filter((r) => isScheduled(r, date));
}

export function dayStatus(
  routines: Routine[],
  done: Set<string>, // keys `${routineId}|${date}`
  date: string,
): DayStatus {
  const scheduled = scheduledOn(routines, date);
  if (scheduled.length === 0) return 'empty';
  const n = scheduled.filter((r) => done.has(completionKey(r.id, date))).length;
  if (n === 0) return 'none';
  return n === scheduled.length ? 'all' : 'partial';
}

export const completionKey = (routineId: string, date: string) => `${routineId}|${date}`;

export function toDoneSet(completions: Completion[]): Set<string> {
  return new Set(completions.map((c) => completionKey(c.routineId, c.date)));
}

/** Consecutive fully-done days ending today (or yesterday if today isn't finished yet). */
export function currentStreak(routines: Routine[], done: Set<string>): number {
  const today = todayKey();
  let cursor = today;
  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    const s = dayStatus(routines, done, cursor);
    if (s === 'all') streak++;
    else if (s === 'empty') {
      // unscheduled days neither break nor extend the streak
    } else if (cursor === today) {
      // today still in progress — look at yesterday
    } else break;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function recurrenceLabel(r: Routine['recurrence']): string {
  if (r.type === 'daily' || r.days.length === 7) return 'Every day';
  return [...r.days].sort().map((d) => DAY_NAMES[d]).join(' · ');
}
