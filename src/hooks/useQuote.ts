import { useEffect, useState } from 'react';
import { sqliteSettingsRepo } from '@/data/sqliteRepository';
import { parseQuoteIndex, pickQuoteIndex, QUOTES, type Quote } from '@/domain/quotes';

const KEY = 'quote_last';

// One pick per app launch: the Routines tab stays mounted, so remount/tab switches keep the same line.
let launchPick: Promise<Quote | null> | null = null;

function pickForLaunch(): Promise<Quote | null> {
  launchPick ??= (async () => {
    const last = parseQuoteIndex(await sqliteSettingsRepo.getValue(KEY));
    const idx = pickQuoteIndex(QUOTES.length, last);
    if (idx < 0) return null;
    await sqliteSettingsRepo.setValue(KEY, String(idx)).catch(() => {});
    return QUOTES[idx];
  })().catch(() => QUOTES[pickQuoteIndex(QUOTES.length, null)] ?? null);
  return launchPick;
}

/** The "Atomic Habits" line for this app launch (null until it is picked), different from the previous launch's. */
export function useQuote(): Quote | null {
  const [quote, setQuote] = useState<Quote | null>(null);
  useEffect(() => {
    let alive = true;
    pickForLaunch().then((q) => alive && setQuote(q));
    return () => {
      alive = false;
    };
  }, []);
  return quote;
}
