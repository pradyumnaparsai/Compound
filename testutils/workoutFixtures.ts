import type { Workout, WorkoutExercise, WorkoutSet, SetType } from '@/domain/workout';

let n = 0;
const id = (p: string) => `${p}${++n}`;

export const set = (
  weightKg: number | null,
  reps: number | null,
  { type, ...opts }: Partial<WorkoutSet> & { type?: SetType } = {},
): WorkoutSet => ({
  id: id('s'),
  index: 0,
  setType: type ?? 'normal',
  weightKg,
  reps,
  durationSeconds: null,
  distanceMeters: null,
  rpe: null,
  isCompleted: true,
  completedAt: null,
  ...opts,
});

export const ex = (exerciseId: string, sets: WorkoutSet[], opts: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  id: id('e'),
  exerciseId,
  position: 0,
  supersetId: null,
  restSeconds: 90,
  notes: '',
  notesPinned: false,
  sets: sets.map((s, i) => ({ ...s, index: i })),
  ...opts,
});

export const workout = (date: string, exercises: WorkoutExercise[], opts: Partial<Workout> = {}): Workout => ({
  id: id('w'),
  title: 'Workout',
  templateId: null,
  startedAt: `${date}T10:00:00.000Z`,
  endedAt: `${date}T11:00:00.000Z`,
  date,
  notes: '',
  exercises: exercises.map((e, i) => ({ ...e, position: i })),
  ...opts,
});
