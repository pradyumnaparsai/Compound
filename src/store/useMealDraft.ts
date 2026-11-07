import { create } from 'zustand';
import type { Ingredient } from '@/domain/meal';

/** Items of the meal being built; shared between the meal builder and the food search/scan modal. */
type State = {
  items: Ingredient[];
  reset: (items?: Ingredient[]) => void;
  add: (i: Ingredient) => void;
  remove: (index: number) => void;
};

export const useMealDraft = create<State>((set, get) => ({
  items: [],
  reset: (items = []) => set({ items }),
  add: (i) => set({ items: [...get().items, i] }),
  remove: (index) => set({ items: get().items.filter((_, n) => n !== index) }),
}));
