export type Recurrence =
  | { type: 'daily' }
  | { type: 'weekly'; days: number[] }; // 0 = Sunday … 6 = Saturday

/** Optional auto-complete rule driven by Apple Health. */
export type Goal =
  | { type: 'steps'; target: number }
  | { type: 'workout' } // a Traditional Strength Training workout logged that day
  | { type: 'protein'; target: number }; // grams of protein logged in the Meals tab that day (not Apple Health)

export type Routine = {
  id: string;
  title: string;
  recurrence: Recurrence;
  goal: Goal | null;
  reminderTime: string | null; // 'HH:mm' (Phase 2)
  createdAt: string; // date key YYYY-MM-DD
  archivedAt: string | null; // date key; routine not scheduled on/after this day
};

export type RoutineInput = Pick<Routine, 'title' | 'recurrence'> &
  Partial<Pick<Routine, 'reminderTime' | 'goal'>>;

export type Completion = { routineId: string; date: string };

/** One-off to-do due on a specific day (not a routine; never repeats). */
export type Task = {
  id: string;
  title: string;
  date: string; // date key YYYY-MM-DD it is due
  createdAt: string; // ISO timestamp
  completedAt: string | null; // ISO timestamp; null = still open
};

export type DayStatus = 'empty' | 'none' | 'partial' | 'all';
