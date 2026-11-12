import { create } from 'zustand';

export type BurstKind = 'small' | 'big' | 'fireworks';
const RANK: Record<BurstKind, number> = { small: 0, big: 1, fireworks: 2 };
/** Screen position (px) a small burst pops from, e.g. the ticked checkbox. */
export type Origin = { x: number; y: number };

type State = {
  /** The confetti burst on screen; a new `id` restarts the animation (a bigger celebration replaces a smaller one). */
  burst: { id: number; kind: BurstKind; origin?: Origin } | null;
  fire: (kind: BurstKind, origin?: Origin) => void;
  clear: (id: number) => void;
};

let seq = 0;

export const useCelebration = create<State>((set, get) => ({
  burst: null,
  fire(kind, origin) {
    const cur = get().burst;
    if (cur && RANK[kind] < RANK[cur.kind]) return; // never downgrade a running celebration
    set({ burst: { id: ++seq, kind, origin } });
  },
  clear(id) {
    if (get().burst?.id === id) set({ burst: null });
  },
}));

/** For code outside React (stores, services). */
export const celebrate = (kind: BurstKind, origin?: Origin) => useCelebration.getState().fire(kind, origin);
