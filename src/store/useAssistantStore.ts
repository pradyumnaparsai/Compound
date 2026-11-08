import { create } from 'zustand';
import type { Action } from '@/domain/assistant';

export type Chip = { id: string; text: string; ok: boolean };
/** The one exchange Atomic shows: what it heard and what it answered. */
export type Exchange = { heard: string; reply: string | null; chips: Chip[]; error?: boolean };
/** Risky actions waiting for a tap or a spoken "yes". */
export type Pending = { actions: Action[]; labels: string[] };
export type Phase = 'idle' | 'thinking' | 'speaking';

type State = {
  open: boolean;
  phase: Phase;
  muted: boolean;
  exchange: Exchange | null;
  pending: Pending | null;
  /** Reverts the last batch of changes; cleared when the next request starts. */
  undo: { count: number; run: () => Promise<void> } | null;
  set: (patch: Partial<Omit<State, 'set'>>) => void;
};

export const useAssistantStore = create<State>((set) => ({
  open: false,
  phase: 'idle',
  muted: false,
  exchange: null,
  pending: null,
  undo: null,
  set: (patch) => set(patch),
}));
