import { useMemo } from 'react';
import { prepEnabled } from '@/domain/prep';
import { useMemoryStore } from '@/store/useMemoryStore';

/** Whether the switch-prep feature is visible for the current user (see `prepEnabled`). */
export function usePrepEnabled(): boolean {
  const memory = useMemoryStore((s) => s.memory);
  return useMemo(() => prepEnabled(memory), [memory]);
}
