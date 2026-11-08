import { useEffect, useRef, useState } from 'react';
import { sqliteSettingsRepo } from '@/data/sqliteRepository';
import { type HintKey, hintFlag, shouldShowHint } from '@/domain/hints';

/**
 * True on first install until the hint has been displayed once (persisted). `eligible` says whether
 * the hint's target is on screen; the flag is only stored once the hint actually renders, and the
 * hint stays up for the rest of that session.
 */
export function useOneTimeHint(key: HintKey, eligible: boolean): boolean {
  const [seenBefore, setSeenBefore] = useState<boolean | null>(null);
  const marked = useRef(false);

  useEffect(() => {
    let alive = true;
    sqliteSettingsRepo
      .getFlag(hintFlag(key))
      .then((v) => alive && setSeenBefore(v))
      .catch(() => alive && setSeenBefore(true)); // on failure, stay quiet
    return () => {
      alive = false;
    };
  }, [key]);

  const visible = eligible && shouldShowHint(seenBefore);

  useEffect(() => {
    if (!visible || marked.current) return;
    marked.current = true;
    sqliteSettingsRepo.setFlag(hintFlag(key)).catch(() => {});
  }, [visible, key]);

  return visible;
}
