import type { Action } from '@/domain/assistant';
import { completionKey, isScheduled } from '@/domain/recurrence';
import { goalLabel } from '@/domain/goal';
import { UserError } from '@/domain/errors';
import { newId } from '@/domain/id';
import { mealFromAnalysis } from '@/domain/meal';
import { EMPTY_MEMORY } from '@/domain/memory';
import { formatWeight } from '@/domain/units';
import { analyzeMeal } from '@/services/mealAnalyzer';
import { useMealStore } from '@/store/useMealStore';
import { useMemoryStore } from '@/store/useMemoryStore';
import { useRoutineStore } from '@/store/useRoutineStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useUnitStore } from '@/store/useUnitStore';
import { useWeightStore } from '@/store/useWeightStore';

export type Applied = {
  /** Shown on the action chip. */
  text: string;
  /** Appended to the spoken reply (e.g. a logged meal's macros, which are only known afterwards). */
  spoken?: string;
  /** Present when the change can be reverted. */
  undo?: () => Promise<void>;
};

/** Applies one validated action through the same stores the screens use. Throws UserError for expected failures. */
export async function applyAction(a: Action, now: Date, signal?: AbortSignal): Promise<Applied> {
  switch (a.type) {
    case 'add_routine': {
      const s = useRoutineStore.getState();
      await s.addRoutine({ title: a.title, recurrence: a.days ? { type: 'weekly', days: a.days } : { type: 'daily' } });
      const created = useRoutineStore.getState().routines.at(-1);
      return {
        text: `Routine added: ${a.title}`,
        undo: created ? () => useRoutineStore.getState().archiveRoutine(created.id) : undefined,
      };
    }
    case 'add_task': {
      await useTaskStore.getState().add(a.title, a.date);
      const created = useTaskStore.getState().tasks.at(-1);
      return {
        text: `Task added: ${a.title}`,
        undo: created ? () => useTaskStore.getState().remove(created.id) : undefined,
      };
    }
    case 'log_meal': {
      const analysis = await analyzeMeal({ note: a.description, signal });
      const meal = mealFromAnalysis(analysis, a.slot, a.date, now, newId());
      await useMealStore.getState().add(meal);
      return {
        text: `Logged ${meal.title}: ${meal.calories} kcal · ${meal.proteinG} g protein`,
        spoken: `${meal.title} is about ${meal.calories} calories and ${Math.round(meal.proteinG)} grams of protein.`,
        undo: () => useMealStore.getState().remove(meal.id),
      };
    }
    case 'set_routine_done': {
      const { routines, done, toggle } = useRoutineStore.getState();
      const r = routines.find((x) => x.id === a.id);
      if (!r) throw new UserError(`I could not find "${a.title}" any more.`);
      if (r.goal) throw new UserError(`"${r.title}" checks itself off from ${goalLabel(r.goal)}.`);
      if (!isScheduled(r, a.date)) throw new UserError(`"${r.title}" is not scheduled that day.`);
      if (done.has(completionKey(r.id, a.date)) === a.done) {
        return { text: `${r.title} was already ${a.done ? 'done' : 'unchecked'}` };
      }
      await toggle(r.id, a.date);
      return { text: `${a.done ? 'Checked off' : 'Unchecked'} ${r.title}`, undo: () => toggle(r.id, a.date) };
    }
    case 'set_task_done': {
      const { tasks, toggle } = useTaskStore.getState();
      const t = tasks.find((x) => x.id === a.id);
      if (!t) throw new UserError(`I could not find "${a.title}" any more.`);
      if (!!t.completedAt === a.done) return { text: `${t.title} was already ${a.done ? 'done' : 'open'}` };
      await toggle(t.id);
      return { text: `${a.done ? 'Completed' : 'Reopened'} ${t.title}`, undo: () => toggle(t.id) };
    }
    case 'reschedule_task': {
      const { tasks, reschedule } = useTaskStore.getState();
      const t = tasks.find((x) => x.id === a.id);
      if (!t) throw new UserError(`I could not find "${a.title}" any more.`);
      const prev = t.date;
      await reschedule(t.id, a.date);
      return { text: `Moved ${t.title} to ${a.date}`, undo: () => reschedule(t.id, prev) };
    }
    case 'log_weight': {
      const { entries, log, remove } = useWeightStore.getState();
      const prev = entries.find((e) => e.date === a.date);
      await log(a.date, a.kg);
      return { text: `Weight logged: ${formatWeight(a.kg, useUnitStore.getState().unit)}`, undo: () => (prev ? log(a.date, prev.kg) : remove(a.date)) };
    }
    case 'set_goals': {
      const prev = useMealStore.getState().goals;
      await useMealStore.getState().setGoals({ calories: a.calories, proteinG: a.proteinG });
      return {
        text: `Goals set: ${a.calories} kcal · ${a.proteinG} g protein`,
        undo: () => useMealStore.getState().setGoals(prev),
      };
    }
    case 'archive_routine': {
      await useRoutineStore.getState().archiveRoutine(a.id);
      return { text: `Archived ${a.title}` };
    }
    case 'delete_task': {
      await useTaskStore.getState().remove(a.id);
      return { text: `Deleted task ${a.title}` };
    }
    case 'delete_meal': {
      await useMealStore.getState().remove(a.id);
      return { text: `Deleted meal ${a.title}` };
    }
    case 'remember': {
      const s = useMemoryStore.getState();
      const before = s.memory;
      const { added } = await s.remember(a.category, a.text);
      if (!added) return { text: `Already remembered: ${a.text}` };
      return { text: `Remembered: ${added.text}`, undo: () => s.replace(before) };
    }
    case 'forget': {
      const s = useMemoryStore.getState();
      const before = s.memory;
      if (!before.facts.some((f) => f.id === a.id)) throw new UserError(`I no longer remember "${a.title}".`);
      await s.forget(a.id);
      return { text: `Forgot: ${a.title}`, undo: () => s.replace(before) };
    }
    case 'forget_all': {
      const s = useMemoryStore.getState();
      const before = s.memory;
      await s.replace(EMPTY_MEMORY);
      return { text: 'Forgot everything about you', undo: () => s.replace(before) };
    }
    case 'skip_topic': {
      await useMemoryStore.getState().skip(a.topic);
      return { text: `Okay, I won't ask about ${a.topic}` };
    }
  }
}
