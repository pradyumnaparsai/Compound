import { addDays } from '@/domain/date';
import {
  CARRY_DAYS,
  agendaFor,
  agendaProgress,
  dayStatus,
  itemDone,
  itemKeys,
  itemProgress,
  prepEnabled,
  prepStreak,
  studyDayPosition,
  toggleTarget,
} from '@/domain/prep';
import { addFact, EMPTY_MEMORY } from '@/domain/memory';
import { PREP_END, PREP_PLAN, PREP_START, WEDDING_BREAK, type PrepDay } from '@/domain/prepPlan';

const day = (date: string) => PREP_PLAN.find((d) => d.date === date)!;
const allKeys = (d: PrepDay) => new Set(d.items.flatMap(itemKeys));

describe('plan calendar', () => {
  it('spans Nov 15 - Jan 4 with no gaps or duplicates', () => {
    expect(PREP_START).toBe('2026-11-15');
    expect(PREP_END).toBe('2027-01-04');
    PREP_PLAN.forEach((d, i) => expect(d.date).toBe(addDays(PREP_START, i)));
    expect(PREP_PLAN).toHaveLength(51);
  });

  it('has 42 study days in the six weeks', () => {
    expect(PREP_PLAN.filter((d) => d.week !== null)).toHaveLength(42);
  });

  it('keeps the wedding break free', () => {
    for (const d of WEDDING_BREAK) {
      expect(day(d).rest).toBe(true);
      expect(day(d).items).toEqual([]);
    }
  });

  it('has globally unique item and step ids', () => {
    const ids = PREP_PLAN.flatMap((d) => d.items.flatMap((i) => [i.id, ...i.steps.map((s) => s.id)]));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('schedules 48 core DSA problems and 12 extension slots', () => {
    const dsa = PREP_PLAN.flatMap((d) => d.items).filter((i) => i.kind === 'dsa');
    expect(dsa.filter((i) => i.badge?.startsWith('Core'))).toHaveLength(48);
    expect(dsa.filter((i) => i.badge === 'Extension / revision')).toHaveLength(12);
    expect(new Set(dsa.map((i) => i.title)).size).toBe(60);
  });

  it('gives six LLD and six HLD exercises two days each', () => {
    const items = PREP_PLAN.flatMap((d) => d.items);
    expect(items.filter((i) => i.kind === 'lld')).toHaveLength(12);
    expect(items.filter((i) => i.kind === 'hld')).toHaveLength(12);
    expect(day('2026-11-27').items.find((i) => i.kind === 'lld')?.title).toBe('LLD: Thread-safe LRU Cache');
    expect(day('2026-11-28').items.find((i) => i.kind === 'lld')?.badge).toMatch(/Day 2\/2/);
  });

  it('has the twelve scheduled mocks on the right dates', () => {
    const mocks = PREP_PLAN.filter((d) => d.week !== null && d.items.some((i) => i.kind === 'mock')).map((d) => d.date);
    expect(mocks).toEqual([
      '2026-11-20', '2026-11-21', '2026-12-01', '2026-12-02', '2026-12-08', '2026-12-09',
      '2026-12-15', '2026-12-16', '2026-12-22', '2026-12-23', '2026-12-29', '2026-12-30',
    ]);
  });

  it('covers all 8 STAR stories', () => {
    const stories = PREP_PLAN.flatMap((d) => d.items).filter((i) => i.kind === 'behavioral' && i.steps.length);
    expect(stories.flatMap((i) => i.steps)).toHaveLength(8);
  });
});

describe('item completion', () => {
  const lld = day('2026-11-15').items.find((i) => i.kind === 'lld')!;
  const dsa = day('2026-11-15').items.find((i) => i.kind === 'dsa')!;

  it('an item without steps is its own checkbox', () => {
    expect(itemKeys(dsa)).toEqual([dsa.id]);
    expect(itemDone(dsa, new Set())).toBe(false);
    expect(itemDone(dsa, new Set([dsa.id]))).toBe(true);
  });

  it('an item with steps is done only when every step is', () => {
    const keys = itemKeys(lld);
    expect(keys).toHaveLength(5);
    expect(itemProgress(lld, new Set(keys.slice(0, 2)))).toEqual({ done: 2, total: 5 });
    expect(itemDone(lld, new Set(keys.slice(0, 4)))).toBe(false);
    expect(itemDone(lld, new Set(keys))).toBe(true);
  });

  it('toggleTarget finishes everything, or clears a finished item', () => {
    expect(toggleTarget(lld, new Set([itemKeys(lld)[0]]))).toEqual({ keys: itemKeys(lld), done: true });
    expect(toggleTarget(lld, new Set(itemKeys(lld)))).toEqual({ keys: itemKeys(lld), done: false });
  });
});

describe('agendaFor / rollover', () => {
  const today = '2026-11-17';

  it('shows only own items when nothing is behind', () => {
    const done = new Set([...allKeys(day('2026-11-15')), ...allKeys(day('2026-11-16'))]);
    const a = agendaFor(today, today, done);
    expect(a.carried).toEqual([]);
    expect(a.own).toEqual(day(today).items);
  });

  it('rolls unfinished items from recent days into today, oldest first', () => {
    const a = agendaFor(today, today, new Set());
    const froms = a.carried.map((c) => c.from);
    expect(froms).toEqual([...froms].sort());
    expect(new Set(froms)).toEqual(new Set(['2026-11-15', '2026-11-16']));
    expect(a.carried.length).toBe(day('2026-11-15').items.length + day('2026-11-16').items.length);
  });

  it('drops carried items once they are checked, even partly-done ones stay until finished', () => {
    const lld = day('2026-11-16').items.find((i) => i.kind === 'lld')!;
    const partial = new Set([...allKeys(day('2026-11-15')), ...itemKeys(lld).slice(0, 2)]);
    const a = agendaFor(today, today, partial);
    expect(a.carried.map((c) => c.item.id)).toContain(lld.id);
    const finished = new Set([...allKeys(day('2026-11-15')), ...allKeys(day('2026-11-16'))]);
    expect(agendaFor(today, today, finished).carried).toEqual([]);
  });

  it('only looks back CARRY_DAYS days', () => {
    const d = '2026-12-07';
    const a = agendaFor(d, d, new Set());
    const oldest = addDays(d, -CARRY_DAYS);
    expect(a.carried.every((c) => c.from >= oldest)).toBe(true);
  });

  it('never carries mocks', () => {
    // Nov 20 DSA mock is unfinished; looking from Nov 22 (Nov 21 is a mock too).
    const a = agendaFor('2026-11-22', '2026-11-22', new Set());
    expect(a.carried.some((c) => c.item.kind === 'mock')).toBe(false);
  });

  it('never carries across the wedding break', () => {
    const a = agendaFor('2026-11-27', '2026-11-27', new Set());
    expect(a.carried).toEqual([]);
  });

  it('does not carry into rest days, past days or future days', () => {
    expect(agendaFor('2026-11-24', '2026-11-24', new Set()).carried).toEqual([]);
    expect(agendaFor('2026-11-16', today, new Set()).carried).toEqual([]);
    expect(agendaFor('2026-11-18', today, new Set()).carried).toEqual([]);
  });

  it('is empty outside the plan', () => {
    const a = agendaFor('2026-11-14', '2026-11-14', new Set());
    expect(a.day).toBeUndefined();
    expect(a.own).toEqual([]);
    expect(agendaProgress(a, new Set())).toEqual({ done: 0, total: 0, fraction: 0, complete: false });
  });
});

describe('agendaProgress', () => {
  it('completes only when every item (own and carried) is done', () => {
    const today = '2026-11-16';
    const d15 = day('2026-11-15');
    const d16 = day(today);
    const checked = new Set(allKeys(d16));
    const a = agendaFor(today, today, checked);
    const p = agendaProgress(a, checked);
    expect(p.done).toBe(d16.items.length);
    expect(p.total).toBe(d16.items.length + d15.items.length);
    expect(p.complete).toBe(false);
    for (const k of allKeys(d15)) checked.add(k);
    const done = agendaProgress(agendaFor(today, today, checked), checked);
    expect(done).toMatchObject({ complete: true, fraction: 1 });
  });

  it('a rest day has nothing to complete', () => {
    const a = agendaFor('2026-11-24', '2026-11-24', new Set());
    expect(agendaProgress(a, new Set()).complete).toBe(false);
    expect(agendaProgress(a, new Set()).total).toBe(0);
  });
});

describe('dayStatus', () => {
  const d = day('2026-11-15');
  it('reports rest / none / partial / done', () => {
    expect(dayStatus(day('2026-11-24'), new Set())).toBe('rest');
    expect(dayStatus(d, new Set())).toBe('none');
    expect(dayStatus(d, new Set([d.items[0].id]))).toBe('partial');
    expect(dayStatus(d, allKeys(d))).toBe('done');
  });
});

describe('prepStreak', () => {
  const done = (...dates: string[]) => new Set(dates.flatMap((x) => [...allKeys(day(x))]));

  it('is 0 before the plan starts', () => {
    expect(prepStreak('2026-11-14', new Set())).toBe(0);
  });

  it('counts consecutive finished days; an unfinished today does not break it', () => {
    expect(prepStreak('2026-11-17', done('2026-11-15', '2026-11-16'))).toBe(2);
    expect(prepStreak('2026-11-17', done('2026-11-15', '2026-11-16', '2026-11-17'))).toBe(3);
  });

  it('breaks on a missed past day', () => {
    expect(prepStreak('2026-11-18', done('2026-11-15', '2026-11-17'))).toBe(1);
  });

  it('skips the wedding break instead of breaking on it', () => {
    expect(prepStreak('2026-11-27', done('2026-11-21', '2026-11-22', '2026-11-20', '2026-11-19'))).toBe(4);
  });

  it('keeps counting the last day after the plan ends', () => {
    expect(prepStreak('2027-02-01', done('2027-01-03', '2027-01-04'))).toBe(2);
  });
});

describe('studyDayPosition', () => {
  it('numbers study days and skips rest days', () => {
    const total = PREP_PLAN.filter((d) => !d.rest).length;
    expect(studyDayPosition('2026-11-15')).toEqual({ n: 1, total });
    expect(studyDayPosition('2026-11-22')).toEqual({ n: 8, total });
    expect(studyDayPosition('2026-11-27')).toEqual({ n: 9, total });
    expect(studyDayPosition(PREP_END).n).toBe(total);
  });
});

describe('prepEnabled', () => {
  const named = (text: string) => addFact(EMPTY_MEMORY, 'name', text, 'n1').memory;

  it('is off with no saved name', () => {
    expect(prepEnabled(EMPTY_MEMORY)).toBe(false);
  });

  it('is on for Pradyumna however the name was saved', () => {
    expect(prepEnabled(named('Pradyumna'))).toBe(true);
    expect(prepEnabled(named('Pradyumna Parsai'))).toBe(true);
    expect(prepEnabled(named('call me pradyumna'))).toBe(true);
    expect(prepEnabled(named('PRADYUMNA'))).toBe(true);
  });

  it('is off for anyone else', () => {
    expect(prepEnabled(named('Alex'))).toBe(false);
    expect(prepEnabled(named('Not Pradyumna'))).toBe(false);
  });
});
