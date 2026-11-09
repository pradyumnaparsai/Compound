// Pure logic for Atomic's long-term memory: a small, capped list of short facts about the user that is sent
// with every request so answers fit them. Stored as one JSON string in the settings table (so it is part of
// the cloud backup). Everything read back from storage or from the model is validated here.

export const MEMORY_CATEGORIES = ['name', 'tone', 'diet', 'fitness', 'schedule', 'other'] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export type MemoryFact = { id: string; category: MemoryCategory; text: string };

/** What is saved: the facts, plus onboarding topics the user chose to skip (so Atomic stops asking). */
export type Memory = { facts: MemoryFact[]; skipped: MemoryCategory[] };

export const MAX_FACTS = 40;
export const MAX_FACT_CHARS = 140;
/** Hard cap on the memory block sent to the model, whatever is stored. */
export const MAX_CONTEXT_CHARS = 1600;

/** Topics Atomic asks about in the first chats, in this order. */
export const ONBOARDING_TOPICS: MemoryCategory[] = ['name', 'tone', 'diet', 'fitness', 'schedule'];
/** These hold one value: a new one replaces the old. */
const SINGLE: ReadonlySet<MemoryCategory> = new Set(['name', 'tone']);

export const EMPTY_MEMORY: Memory = { facts: [], skipped: [] };

export const isMemoryCategory = (v: unknown): v is MemoryCategory =>
  typeof v === 'string' && (MEMORY_CATEGORIES as readonly string[]).includes(v);

const tidy = (s: unknown): string =>
  typeof s === 'string' ? s.replace(/[\r\n|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_FACT_CHARS) : '';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Reads stored memory; anything malformed is dropped rather than throwing. */
export function parseMemory(raw: string | null): Memory {
  if (!raw) return EMPTY_MEMORY;
  try {
    const v = JSON.parse(raw) as { facts?: unknown; skipped?: unknown };
    const facts: MemoryFact[] = [];
    const ids = new Set<string>();
    for (const f of Array.isArray(v.facts) ? v.facts : []) {
      if (!f || typeof f !== 'object') continue;
      const { id, category, text } = f as Record<string, unknown>;
      const t = tidy(text);
      if (typeof id !== 'string' || !id || ids.has(id) || !isMemoryCategory(category) || !t) continue;
      ids.add(id);
      facts.push({ id, category, text: t });
    }
    const skipped = (Array.isArray(v.skipped) ? v.skipped : []).filter(isMemoryCategory);
    return { facts: facts.slice(0, MAX_FACTS), skipped: [...new Set(skipped)] };
  } catch {
    return EMPTY_MEMORY;
  }
}

export const serializeMemory = (m: Memory): string => JSON.stringify(m);

export type AddResult = { memory: Memory; added: MemoryFact | null; replaced: MemoryFact[] };

/**
 * Adds a fact. A duplicate (same words) is ignored; name/tone replace the earlier value. When full, the oldest
 * non-name fact makes room, so the newest preference always wins.
 */
export function addFact(m: Memory, category: MemoryCategory, text: unknown, id: string): AddResult {
  const t = tidy(text);
  if (!t) return { memory: m, added: null, replaced: [] };
  if (m.facts.some((f) => f.category === category && norm(f.text) === norm(t))) return { memory: m, added: null, replaced: [] };

  let facts = m.facts;
  const replaced: MemoryFact[] = [];
  if (SINGLE.has(category)) {
    replaced.push(...facts.filter((f) => f.category === category));
    facts = facts.filter((f) => f.category !== category);
  }
  while (facts.length >= MAX_FACTS) {
    const drop = facts.find((f) => f.category !== 'name') ?? facts[0];
    replaced.push(drop);
    facts = facts.filter((f) => f !== drop);
  }
  const added: MemoryFact = { id, category, text: t };
  // Giving an answer for a topic ends any earlier "skip" for it.
  return { memory: { facts: [...facts, added], skipped: m.skipped.filter((c) => c !== category) }, added, replaced };
}

export function removeFact(m: Memory, id: string): Memory {
  return m.facts.some((f) => f.id === id) ? { ...m, facts: m.facts.filter((f) => f.id !== id) } : m;
}

export function skipTopic(m: Memory, topic: MemoryCategory): Memory {
  return m.skipped.includes(topic) ? m : { ...m, skipped: [...m.skipped, topic] };
}

/** Onboarding topics still unanswered and not skipped. */
export function missingTopics(m: Memory): MemoryCategory[] {
  return ONBOARDING_TOPICS.filter((c) => !m.skipped.includes(c) && !m.facts.some((f) => f.category === c));
}

export type MemoryRef = { ref: string; fact: MemoryFact };

/**
 * What the model sees: remembered facts as refs (f1, f2…) it can point at, then what onboarding still needs.
 * Capped in size; `items` holds exactly the facts shown, so a ref always resolves to what the model read.
 */
export function memoryContext(m: Memory): { lines: string[]; items: MemoryRef[] } {
  const items: MemoryRef[] = [];
  let used = 0;
  for (const [i, fact] of m.facts.entries()) {
    const line = `f${i + 1}|${fact.category}|${fact.text}`;
    if (used + line.length > MAX_CONTEXT_CHARS) break;
    used += line.length;
    items.push({ ref: `f${i + 1}`, fact });
  }
  const missing = missingTopics(m);
  const lines = [
    'Remembered about the user (ref|topic|fact):',
    ...(items.length ? items.map(({ ref, fact }) => `${ref}|${fact.category}|${fact.text}`) : ['none yet']),
    missing.length
      ? `Profile still unknown (ask about the first one): ${missing.join(', ')}`
      : 'Profile complete: do not ask onboarding questions.',
  ];
  return { lines, items };
}
