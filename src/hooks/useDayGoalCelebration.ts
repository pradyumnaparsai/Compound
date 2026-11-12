import { useEffect, useRef } from 'react';
import { sqliteSettingsRepo } from '@/data/sqliteRepository';
import { crossedThreshold } from '@/domain/celebrate';
import { completionKey, scheduledOn } from '@/domain/recurrence';
import { dayProgress, overdueTasks, tasksOn } from '@/domain/task';
import { useToday } from '@/hooks/useToday';
import { celebrate } from '@/store/useCelebration';
import { useRoutineStore } from '@/store/useRoutineStore';
import { useTaskStore } from '@/store/useTaskStore';

const KEY = 'day_goal_celebrated';

/** Big celebration the first time each day that 80% of routines + tasks are done. Mount once, app-wide. */
export function useDayGoalCelebration() {
  const today = useToday();
  const routines = useRoutineStore((s) => s.routines);
  const done = useRoutineStore((s) => s.done);
  const routinesReady = useRoutineStore((s) => s.ready);
  const tasks = useTaskStore((s) => s.tasks);
  const tasksReady = useTaskStore((s) => s.ready);
  const prev = useRef<{ date: string; fraction: number; done: number } | null>(null);

  useEffect(() => {
    if (!routinesReady || !tasksReady) return;
    const scheduled = scheduledOn(routines, today);
    const doneCount = scheduled.filter((r) => done.has(completionKey(r.id, today))).length;
    const p = dayProgress(doneCount, scheduled.length, tasksOn(tasks, today), overdueTasks(tasks, today));
    const last = prev.current?.date === today ? prev.current : null;
    prev.current = { date: today, fraction: p.fraction, done: p.done };

    // Only a newly ticked item counts (deleting an open task can also lift the fraction).
    if (!last || p.total === 0 || p.done <= last.done || !crossedThreshold(last.fraction, p.fraction)) return;
    (async () => {
      if ((await sqliteSettingsRepo.getValue(KEY)) === today) return; // once per day
      await sqliteSettingsRepo.setValue(KEY, today);
      celebrate('big');
    })().catch(() => {});
  }, [routines, done, tasks, today, routinesReady, tasksReady]);
}
