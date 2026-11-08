import { create } from 'zustand';
import type { Action } from '@/domain/assistant';

export type Chip = { id: string; text: string; ok: boolean };
export type Msg = { id: string; role: 'user' | 'assistant'; text: string; chips?: Chip[]; error?: boolean };
/** Risky actions waiting for a tap or a spoken "yes". */
export type Pending = { actions: Action[]; labels: string[] };
export type Phase = 'idle' | 'thinking' | 'speaking';

type State = {
  open: boolean;
  phase: Phase;
  muted: boolean;
  messages: Msg[];
  pending: Pending | null;
  /** Reverts the last batch of changes; cleared when the next request starts. */
  undo: { count: number; run: () => Promise<void> } | null;
  setOpen: (open: boolean) => void;
  set: (patch: Partial<Omit<State, 'set' | 'setOpen' | 'push'>>) => void;
  push: (m: Msg) => void;
};

const MAX_MESSAGES = 30;

export const useAssistantStore = create<State>((set, get) => ({
  open: false,
  phase: 'idle',
  muted: false,
  messages: [],
  pending: null,
  undo: null,
  setOpen: (open) => set({ open }),
  set: (patch) => set(patch),
  push: (m) => set({ messages: [...get().messages, m].slice(-MAX_MESSAGES) }),
}));
