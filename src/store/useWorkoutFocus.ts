import { create } from 'zustand';

type State = {
  /** Workout to highlight at the top of Body → History (set when a workout is finished, cleared on leaving the tab). */
  highlightId: string | null;
  highlight: (id: string) => void;
  clear: () => void;
};

export const useWorkoutFocus = create<State>((set) => ({
  highlightId: null,
  highlight: (id) => set({ highlightId: id }),
  clear: () => set({ highlightId: null }),
}));
