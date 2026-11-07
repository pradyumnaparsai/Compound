import { toKey } from './date';
import type { Task } from './types';

export const tasksOn = (tasks: Task[], date: string) => tasks.filter((t) => t.date === date);

/** Tasks due before `today` that are still open, or were ticked off today (so they can be un-ticked). */
export const overdueTasks = (tasks: Task[], today: string) =>
  tasks.filter((t) => t.date < today && (!t.completedAt || toKey(new Date(t.completedAt)) === today));

/** Per-day counts, for calendar markers. */
export function taskCounts(tasks: Task[]): Map<string, { total: number; open: number }> {
  const out = new Map<string, { total: number; open: number }>();
  for (const t of tasks) {
    const c = out.get(t.date) ?? { total: 0, open: 0 };
    c.total++;
    if (!t.completedAt) c.open++;
    out.set(t.date, c);
  }
  return out;
}

/** Combined "done today" progress: today's routines plus today's and overdue tasks. */
export function dayProgress(routinesDone: number, routinesTotal: number, todayTasks: Task[], overdue: Task[]) {
  const tasks = [...todayTasks, ...overdue];
  const done = routinesDone + tasks.filter((t) => !!t.completedAt).length;
  const total = routinesTotal + tasks.length;
  return { done, total, fraction: total ? done / total : 0 };
}
