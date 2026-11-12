/** One-time gesture hints: shown until first seen, then never again. */
export type HintKey = 'reorder' | 'archive-routine' | 'reorder-routines' | 'delete-entry';

export const hintFlag = (key: HintKey) => `hint_${key}`;

/**
 * `seenBefore` is the flag value loaded at startup (null while loading: hide to avoid a flash).
 * It is never updated mid-session, so a hint that appeared stays visible until the next launch.
 */
export function shouldShowHint(seenBefore: boolean | null): boolean {
  return seenBefore === false;
}
