import { makePop } from '@/domain/celebrate';
import { displayName, type Memory } from '@/domain/memory';
import { parseQuoteIndex, pickQuoteIndex, QUOTES } from '@/domain/quotes';

const mem = (...names: string[]): Memory => ({
  facts: names.map((text, i) => ({ id: `n${i}`, category: 'name' as const, text })),
  skipped: [],
});

describe('displayName', () => {
  it.each([
    ['Pradyumna', 'Pradyumna'],
    ['pradyumna parsai', 'Pradyumna'],
    ['My name is Pradyumna', 'Pradyumna'],
    ['call me Pru', 'Pru'],
    ["I'm Alex.", 'Alex'],
    ['Hey, it’s Sam!', 'Sam'],
    ['Name: Priya Sharma', 'Priya'],
    ['José', 'José'],
  ])('%s -> %s', (text, expected) => expect(displayName(mem(text))).toBe(expected));

  it('is null with no name fact, an empty one, or junk', () => {
    expect(displayName({ facts: [], skipped: [] })).toBeNull();
    expect(displayName({ facts: [{ id: 'a', category: 'diet', text: 'vegetarian' }], skipped: [] })).toBeNull();
    expect(displayName(mem('42'))).toBeNull();
    expect(displayName(mem('x'))).toBeNull();
    expect(displayName(mem('Supercalifragilisticexpialidocious'))).toBeNull();
  });

  it('uses the latest name fact', () => {
    expect(displayName(mem('Old', 'Newer'))).toBe('Newer');
  });
});

describe('quotes', () => {
  it('has short, non-empty, unique lines', () => {
    expect(QUOTES.length).toBeGreaterThan(5);
    expect(new Set(QUOTES.map((q) => q.text)).size).toBe(QUOTES.length);
    for (const q of QUOTES) {
      expect(q.text.length).toBeGreaterThan(10);
      expect(q.text.length).toBeLessThanOrEqual(140);
    }
  });

  it('never repeats the previous index and stays in range', () => {
    for (let last = 0; last < 5; last++) {
      for (const r of [0, 0.19, 0.2, 0.5, 0.999999]) {
        const i = pickQuoteIndex(5, last, () => r);
        expect(i).not.toBe(last);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(5);
      }
    }
    expect(pickQuoteIndex(5, null, () => 0.5)).toBe(2);
  });

  it('handles tiny lists', () => {
    expect(pickQuoteIndex(0, null)).toBe(-1);
    expect(pickQuoteIndex(1, 0)).toBe(0);
  });

  it('parses the stored index defensively', () => {
    expect(parseQuoteIndex('3')).toBe(3);
    expect(parseQuoteIndex(null)).toBeNull();
    expect(parseQuoteIndex('abc')).toBeNull();
    expect(parseQuoteIndex('-1')).toBeNull();
    expect(parseQuoteIndex('1.5')).toBeNull();
  });
});

describe('makePop', () => {
  it('spreads particles all around the origin', () => {
    const ps = makePop(14, () => 0.5);
    expect(ps).toHaveLength(14);
    const angles = ps.map((p) => p.angle);
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(Math.PI * 1.7);
    for (const p of makePop(100)) {
      expect(p.dist).toBeGreaterThanOrEqual(38);
      expect(p.dist).toBeLessThanOrEqual(92);
      expect(p.delay).toBeLessThan(0.12);
    }
    expect(makePop(0)).toEqual([]);
  });
});
