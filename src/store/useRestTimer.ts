import { create } from 'zustand';
import { adjustEnd } from '@/domain/restTimer';

type State = {
  /** Epoch ms when the rest ends; null = no timer running. */
  endsAt: number | null;
  totalSeconds: number;
  start: (seconds: number) => void;
  adjust: (deltaSeconds: number) => void;
  stop: () => void;
};

export const useRestTimer = create<State>((set, get) => ({
  endsAt: null,
  totalSeconds: 0,
  start: (seconds) => (seconds > 0 ? set({ endsAt: Date.now() + seconds * 1000, totalSeconds: seconds }) : set({ endsAt: null, totalSeconds: 0 })),
  adjust: (delta) => {
    const { endsAt, totalSeconds } = get();
    if (endsAt === null) return;
    const next = adjustEnd(endsAt, delta, Date.now());
    set({ endsAt: next, totalSeconds: Math.max(totalSeconds, Math.ceil((next - Date.now()) / 1000)) });
  },
  stop: () => set({ endsAt: null, totalSeconds: 0 }),
}));
