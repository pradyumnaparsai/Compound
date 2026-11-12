import { create } from 'zustand';

type State = {
  /** The day the Meals tab is showing, or null to follow "today". Shared so the floating button logs to that day. */
  picked: string | null;
  setPicked: (date: string | null) => void;
};

export const useDiaryDate = create<State>((set) => ({
  picked: null,
  setPicked: (picked) => set({ picked }),
}));
