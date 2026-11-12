import { create } from 'zustand';

export type BurstKind = 'small' | 'big';

type State = {
  /** The confetti burst on screen; a new `id` restarts the animation (a big burst replaces a small one). */
  burst: { id: number; kind: BurstKind } | null;
  fire: (kind: BurstKind) => void;
  clear: (id: number) => void;
};

let seq = 0;

export const useCelebration = create<State>((set, get) => ({
  burst: null,
  fire(kind) {
    const cur = get().burst;
    if (cur?.kind === 'big' && kind === 'small') return; // never downgrade a running celebration
    set({ burst: { id: ++seq, kind } });
  },
  clear(id) {
    if (get().burst?.id === id) set({ burst: null });
  },
}));

/** For code outside React (stores, services). */
export const celebrate = (kind: BurstKind) => useCelebration.getState().fire(kind);
