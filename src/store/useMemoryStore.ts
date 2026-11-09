import { create } from 'zustand';
import type { SettingsRepository } from '@/data/repository';
import { sqliteSettingsRepo } from '@/data/sqliteRepository';
import { newId } from '@/domain/id';
import {
  addFact,
  EMPTY_MEMORY,
  parseMemory,
  removeFact,
  serializeMemory,
  skipTopic,
  type Memory,
  type MemoryCategory,
  type MemoryFact,
} from '@/domain/memory';

const repo: SettingsRepository = sqliteSettingsRepo;
export const MEMORY_KEY = 'atomic_memory';

type State = {
  memory: Memory;
  ready: boolean;
  load: () => Promise<void>;
  /** Saves a fact; resolves with what changed so the caller can offer Undo. */
  remember: (category: MemoryCategory, text: string) => Promise<{ added: MemoryFact | null; replaced: MemoryFact[] }>;
  forget: (id: string) => Promise<void>;
  skip: (topic: MemoryCategory) => Promise<void>;
  /** Replaces everything (used by Undo and "forget everything"). */
  replace: (m: Memory) => Promise<void>;
};

export const useMemoryStore = create<State>((set, get) => {
  // Optimistic update with rollback if the write fails.
  const commit = async (next: Memory) => {
    const prev = get().memory;
    set({ memory: next });
    try {
      await repo.setValue(MEMORY_KEY, serializeMemory(next));
    } catch (e) {
      set({ memory: prev });
      throw e;
    }
  };
  return {
    memory: EMPTY_MEMORY,
    ready: false,
    async load() {
      set({ memory: parseMemory(await repo.getValue(MEMORY_KEY)), ready: true });
    },
    async remember(category, text) {
      const { memory, added, replaced } = addFact(get().memory, category, text, newId());
      if (added) await commit(memory);
      return { added, replaced };
    },
    async forget(id) {
      await commit(removeFact(get().memory, id));
    },
    async skip(topic) {
      await commit(skipTopic(get().memory, topic));
    },
    async replace(m) {
      await commit(m);
    },
  };
});
