import { create } from 'zustand';

/** Latest Apple Health readings, for showing progress on goal routines. Not persisted. */
type State = {
  steps: Record<string, number>; // date → steps
  workouts: Record<string, number>; // date → workouts logged
  checked: boolean; // at least one successful read this session
  merge: (p: { steps?: Record<string, number>; workouts?: Record<string, number> }) => void;
};

export const useHealthStore = create<State>((set, get) => ({
  steps: {},
  workouts: {},
  checked: false,
  merge: ({ steps, workouts }) =>
    set({
      steps: steps ? { ...get().steps, ...steps } : get().steps,
      workouts: workouts ? { ...get().workouts, ...workouts } : get().workouts,
      checked: true,
    }),
}));
