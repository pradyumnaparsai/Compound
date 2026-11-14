import { addDays } from './date';
import { displayName, type Memory } from './memory';
import { PREP_END, PREP_PLAN, PREP_START, type PrepDay, type PrepItem } from './prepPlan';

/** Keys of everything checked off: step ids, or the item id for items without steps. */
export type Checked = ReadonlySet<string>;

/** Unfinished items from at most this many previous days roll over into today. */
export const CARRY_DAYS = 3;

export type CarriedItem = { item: PrepItem; from: string };

export type PrepAgenda = {
  day: PrepDay | undefined;
  own: PrepItem[];
  carried: CarriedItem[];
};

export type PrepProgress = { done: number; total: number; fraction: number; complete: boolean };

export type PrepDayStatus = 'rest' | 'done' | 'partial' | 'none';

export function planDay(date: string, plan: PrepDay[] = PREP_PLAN): PrepDay | undefined {
  return plan.find((d) => d.date === date);
}

/** The keys that represent this item in the checked set. */
export const itemKeys = (item: PrepItem): string[] => (item.steps.length ? item.steps.map((s) => s.id) : [item.id]);

export function itemProgress(item: PrepItem, checked: Checked): { done: number; total: number } {
  const keys = itemKeys(item);
  return { done: keys.filter((k) => checked.has(k)).length, total: keys.length };
}

export function itemDone(item: PrepItem, checked: Checked): boolean {
  const { done, total } = itemProgress(item, checked);
  return done === total;
}

/** What tapping an item's checkbox should do: finish it (all steps) or, if already finished, clear it. */
export function toggleTarget(item: PrepItem, checked: Checked): { keys: string[]; done: boolean } {
  return { keys: itemKeys(item), done: !itemDone(item, checked) };
}

/**
 * What to show for `date`. Rollover only applies when viewing `today`: unfinished items from the last
 * few days come along, but never across a rest day (so the wedding break creates no catch-up debt)
 * and never mocks, which only make sense on their own day.
 */
export function agendaFor(date: string, today: string, checked: Checked, plan: PrepDay[] = PREP_PLAN): PrepAgenda {
  const day = planDay(date, plan);
  const carried: CarriedItem[] = [];
  if (day && !day.rest && date === today) {
    for (let i = 1; i <= CARRY_DAYS; i++) {
      const from = addDays(date, -i);
      const prev = planDay(from, plan);
      if (!prev || prev.rest) break;
      const open = prev.items.filter((it) => it.kind !== 'mock' && !itemDone(it, checked));
      carried.unshift(...open.map((item) => ({ item, from })));
    }
  }
  return { day, own: day?.items ?? [], carried };
}

export function agendaProgress(a: PrepAgenda, checked: Checked): PrepProgress {
  const all = [...a.own, ...a.carried.map((c) => c.item)];
  const done = all.filter((it) => itemDone(it, checked)).length;
  const total = all.length;
  return { done, total, fraction: total ? done / total : 0, complete: total > 0 && done === total };
}

export function dayStatus(day: PrepDay, checked: Checked): PrepDayStatus {
  if (day.rest || day.items.length === 0) return 'rest';
  const done = day.items.filter((it) => itemDone(it, checked)).length;
  if (done === 0) return 'none';
  return done === day.items.length ? 'done' : 'partial';
}

/** Consecutive fully-done study days ending today (an unfinished today doesn't break it). Rest days are skipped. */
export function prepStreak(today: string, checked: Checked, plan: PrepDay[] = PREP_PLAN): number {
  if (plan.length === 0 || today < plan[0].date) return 0;
  const last = plan[plan.length - 1].date;
  let cursor = today > last ? last : today;
  const live = cursor; // the day that may still be in progress
  let streak = 0;
  for (let i = 0; i < plan.length; i++) {
    const day = planDay(cursor, plan);
    if (!day) break;
    const s = dayStatus(day, checked);
    if (s === 'done') streak++;
    else if (s !== 'rest' && cursor !== live) break;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** 1-based position of `date` among the plan's study days ("Day 12 of 38"), and the total. */
export function studyDayPosition(date: string, plan: PrepDay[] = PREP_PLAN): { n: number; total: number } {
  const study = plan.filter((d) => !d.rest);
  return { n: study.filter((d) => d.date <= date).length, total: study.length };
}

/** Total planned minutes for a day. */
export const dayMinutes = (day: PrepDay): number => day.items.reduce((sum, it) => sum + it.minutes, 0);

/** 145 -> "2h 25m", 90 -> "1h 30m", 45 -> "45m". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export const clampToPlan = (date: string): string => (date < PREP_START ? PREP_START : date > PREP_END ? PREP_END : date);

export const isInPlan = (date: string): boolean => date >= PREP_START && date <= PREP_END;

/** Switch prep is a personal feature: shown only when the saved greeting name is this one. */
export const PREP_OWNER = 'pradyumna';

export function prepEnabled(memory: Memory): boolean {
  return displayName(memory)?.toLowerCase() === PREP_OWNER;
}
