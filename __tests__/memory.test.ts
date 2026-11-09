import { buildContext, describeAction, isRisky, parseAssistantReply } from '../src/domain/assistant';
import {
  addFact,
  EMPTY_MEMORY,
  MAX_CONTEXT_CHARS,
  MAX_FACTS,
  memoryContext,
  missingTopics,
  parseMemory,
  removeFact,
  serializeMemory,
  skipTopic,
  type Memory,
} from '../src/domain/memory';

const NOW = new Date(2026, 10, 8, 9, 30);
const add = (m: Memory, category: Parameters<typeof addFact>[1], text: string, id: string) => addFact(m, category, text, id).memory;
const build = (memory?: Memory) =>
  buildContext({ routines: [], done: new Set(), tasks: [], meals: [], goals: null, weights: [], now: NOW, memory });

describe('parseMemory', () => {
  it('round-trips', () => {
    const m = add(add(EMPTY_MEMORY, 'name', 'Asha', 'a'), 'diet', 'vegetarian', 'b');
    expect(parseMemory(serializeMemory(skipTopic(m, 'fitness')))).toEqual({
      facts: [
        { id: 'a', category: 'name', text: 'Asha' },
        { id: 'b', category: 'diet', text: 'vegetarian' },
      ],
      skipped: ['fitness'],
    });
  });
  it('survives null, garbage and malformed entries', () => {
    expect(parseMemory(null)).toEqual(EMPTY_MEMORY);
    expect(parseMemory('{nope')).toEqual(EMPTY_MEMORY);
    expect(parseMemory('[]')).toEqual(EMPTY_MEMORY);
    const raw = JSON.stringify({
      facts: [{ id: 'a', category: 'diet', text: 'ok' }, { id: 'a', category: 'diet', text: 'dup id' }, { id: 'b', category: 'bogus', text: 'x' }, { id: 'c', category: 'diet', text: '  ' }, null, 5],
      skipped: ['diet', 'diet', 'bogus'],
    });
    expect(parseMemory(raw)).toEqual({ facts: [{ id: 'a', category: 'diet', text: 'ok' }], skipped: ['diet'] });
  });
  it('never returns more than the cap', () => {
    const facts = Array.from({ length: MAX_FACTS + 10 }, (_, i) => ({ id: `i${i}`, category: 'other', text: `fact ${i}` }));
    expect(parseMemory(JSON.stringify({ facts })).facts).toHaveLength(MAX_FACTS);
  });
});

describe('addFact', () => {
  it('ignores empty and duplicate facts', () => {
    const m = add(EMPTY_MEMORY, 'diet', 'No onions', 'a');
    expect(addFact(m, 'diet', '   ', 'b').added).toBeNull();
    expect(addFact(m, 'diet', 'no  onions!', 'b').added).toBeNull();
  });
  it('lets name and tone hold one value', () => {
    let m = add(EMPTY_MEMORY, 'name', 'Asha', 'a');
    const r = addFact(m, 'name', 'Ash', 'b');
    expect(r.memory.facts.map((f) => f.text)).toEqual(['Ash']);
    expect(r.replaced.map((f) => f.text)).toEqual(['Asha']);
    m = add(r.memory, 'diet', 'veg', 'c');
    m = add(m, 'diet', 'no nuts', 'd');
    expect(m.facts.filter((f) => f.category === 'diet')).toHaveLength(2);
  });
  it('keeps the newest facts and the name when full', () => {
    let m = add(EMPTY_MEMORY, 'name', 'Asha', 'n');
    for (let i = 0; i < MAX_FACTS + 5; i++) m = add(m, 'other', `fact ${i}`, `i${i}`);
    expect(m.facts).toHaveLength(MAX_FACTS);
    expect(m.facts[0].text).toBe('Asha');
    expect(m.facts.at(-1)!.text).toBe(`fact ${MAX_FACTS + 4}`);
  });
  it('truncates long text and strips line breaks and pipes', () => {
    const r = addFact(EMPTY_MEMORY, 'other', `a|b\n${'x'.repeat(500)}`, 'a');
    expect(r.added!.text).not.toMatch(/[|\n]/);
    expect(r.added!.text.length).toBeLessThanOrEqual(140);
  });
});

describe('onboarding topics', () => {
  it('lists unanswered topics in order and drops answered or skipped ones', () => {
    expect(missingTopics(EMPTY_MEMORY)).toEqual(['name', 'tone', 'diet', 'fitness', 'schedule']);
    let m = add(EMPTY_MEMORY, 'name', 'Asha', 'a');
    m = skipTopic(m, 'tone');
    expect(missingTopics(m)).toEqual(['diet', 'fitness', 'schedule']);
  });
  it('answering a skipped topic clears the skip', () => {
    const m = add(skipTopic(EMPTY_MEMORY, 'diet'), 'diet', 'vegan', 'a');
    expect(m.skipped).toEqual([]);
  });
  it('removing a fact reopens its topic', () => {
    const m = removeFact(add(EMPTY_MEMORY, 'name', 'Asha', 'a'), 'a');
    expect(missingTopics(m)).toContain('name');
  });
});

describe('memoryContext', () => {
  it('shows refs and what is still unknown', () => {
    const { lines, items } = memoryContext(add(EMPTY_MEMORY, 'diet', 'vegetarian', 'a'));
    expect(lines).toContain('f1|diet|vegetarian');
    expect(lines.join('\n')).toContain('Profile still unknown (ask about the first one): name, tone, fitness, schedule');
    expect(items).toEqual([{ ref: 'f1', fact: { id: 'a', category: 'diet', text: 'vegetarian' } }]);
  });
  it('tells the model to stop asking once the profile is complete', () => {
    let m = EMPTY_MEMORY;
    for (const c of ['name', 'tone', 'diet', 'fitness', 'schedule'] as const) m = add(m, c, `${c} fact`, c);
    expect(memoryContext(m).lines.join('\n')).toContain('Profile complete');
  });
  it('caps the size sent to the model and only exposes the facts it was shown', () => {
    let m = EMPTY_MEMORY;
    for (let i = 0; i < MAX_FACTS; i++) m = add(m, 'other', `${'w'.repeat(130)} ${i}`, `i${i}`);
    const { lines, items } = memoryContext(m);
    const factChars = lines.filter((l) => /^f\d+\|/.test(l)).join('').length;
    expect(factChars).toBeLessThanOrEqual(MAX_CONTEXT_CHARS + 200);
    expect(items.length).toBeLessThan(MAX_FACTS);
    expect(lines.filter((l) => /^f\d+\|/.test(l))).toHaveLength(items.length);
  });
});

describe('Atomic memory actions', () => {
  const m = add(add(EMPTY_MEMORY, 'name', 'Asha', 'a'), 'diet', 'vegetarian', 'b');
  const ctx = () => build(m);
  const reply = (actions: unknown[]) => JSON.stringify({ reply: 'ok', actions });

  it('puts memory and onboarding state into the prompt context', () => {
    expect(ctx().text).toContain('f2|diet|vegetarian');
    expect(build().text).toContain('none yet');
    expect(ctx().facts.map((f) => [f.ref, f.id])).toEqual([['f1', 'a'], ['f2', 'b']]);
  });
  it('parses remember, defaulting an unknown category to other', () => {
    const p = parseAssistantReply(
      reply([
        { type: 'remember', category: 'diet', fact: 'no onions' },
        { type: 'remember', category: 'weird', fact: 'likes tea' },
        { type: 'remember', category: 'diet', fact: '  ' },
      ]),
      ctx(),
      NOW,
    );
    expect(p.actions).toEqual([
      { type: 'remember', category: 'diet', text: 'no onions' },
      { type: 'remember', category: 'other', text: 'likes tea' },
    ]);
    expect(p.skipped).toEqual(['Could not understand what to remember']);
  });
  it('resolves forget by ref and skips unknown refs', () => {
    const p = parseAssistantReply(reply([{ type: 'forget', ref: 'f2' }, { type: 'forget', ref: 'f9' }]), ctx(), NOW);
    expect(p.actions).toEqual([{ type: 'forget', id: 'b', title: 'vegetarian' }]);
    expect(p.skipped).toHaveLength(1);
  });
  it('parses skip_topic only for a valid topic', () => {
    const p = parseAssistantReply(reply([{ type: 'skip_topic', topic: 'diet' }, { type: 'skip_topic', topic: 'nope' }]), ctx(), NOW);
    expect(p.actions).toEqual([{ type: 'skip_topic', topic: 'diet' }]);
  });
  it('asks for confirmation before forgetting everything, not before a single fact', () => {
    expect(isRisky({ type: 'forget_all' })).toBe(true);
    expect(isRisky({ type: 'forget', id: 'a', title: 'x' })).toBe(false);
    expect(isRisky({ type: 'remember', category: 'diet', text: 'x' })).toBe(false);
  });
  it('describes the actions', () => {
    expect(describeAction({ type: 'remember', category: 'diet', text: 'vegan' }, '2026-11-08')).toBe('Remember: vegan');
    expect(describeAction({ type: 'forget_all' }, '2026-11-08')).toBe('Forget everything I know about you');
  });
});
