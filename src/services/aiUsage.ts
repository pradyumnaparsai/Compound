import * as SecureStore from 'expo-secure-store';
import { todayKey } from '@/domain/date';

export type Provider = 'groq' | 'gemini';
export type Usage = { tokens: number; requests: number };
type Stored = { date: string } & Record<Provider, Usage>;

const USAGE_KEY = 'ai.usage';
const LIMIT_KEY = (p: Provider) => `ai.limit.${p}`;

// Providers don't expose remaining quota, so usage is counted on-device and the
// limit is a user-editable estimate (check your plan in the provider console).
export const DEFAULT_LIMITS: Record<Provider, number> = { groq: 500_000, gemini: 1_000_000 };

const empty = (): Stored => ({
  date: todayKey(),
  groq: { tokens: 0, requests: 0 },
  gemini: { tokens: 0, requests: 0 },
});

async function load(): Promise<Stored> {
  try {
    const raw = await SecureStore.getItemAsync(USAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Stored;
      if (s.date === todayKey() && s.groq && s.gemini) return s;
    }
  } catch {}
  return empty();
}

// Serialize writes so concurrent calls don't lose increments.
let chain: Promise<unknown> = Promise.resolve();

export function recordUsage(provider: Provider, tokens: number): Promise<void> {
  const next = chain.then(async () => {
    const s = await load();
    s[provider].tokens += Number.isFinite(tokens) && tokens > 0 ? Math.round(tokens) : 0;
    s[provider].requests += 1;
    await SecureStore.setItemAsync(USAGE_KEY, JSON.stringify(s));
  });
  chain = next.catch(() => {});
  return next.catch(() => {}); // usage tracking must never break an analysis
}

export async function getUsageToday(): Promise<Record<Provider, Usage>> {
  await chain;
  const s = await load();
  return { groq: s.groq, gemini: s.gemini };
}

export async function getLimit(p: Provider): Promise<number> {
  const v = Number(await SecureStore.getItemAsync(LIMIT_KEY(p)));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_LIMITS[p];
}

export const setLimit = (p: Provider, n: number) =>
  Number.isFinite(n) && n > 0 ? SecureStore.setItemAsync(LIMIT_KEY(p), String(Math.round(n))) : SecureStore.deleteItemAsync(LIMIT_KEY(p));
