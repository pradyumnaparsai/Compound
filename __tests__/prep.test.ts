import { addDays } from '@/domain/date';
import {
  CARRY_DAYS,
  agendaFor,
  agendaProgress,
  dayMinutes,
  dayStatus,
  formatMinutes,
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
  const items = PREP_PLAN.flatMap((d) => d.items.map((i) => ({ ...i, date: d.date })));
  const isMain = (kind: string) => (i: { kind: string; badge?: string }) => i.kind === kind && !!i.badge?.startsWith('Day ');

  it('spans Nov 15 - Jan 4 with no gaps or duplicates', () => {
    expect(PREP_START).toBe('2026-11-15');
    expect(PREP_END).toBe('2027-01-04');
    PREP_PLAN.forEach((d, i) => expect(d.date).toBe(addDays(PREP_START, i)));
    expect(PREP_PLAN).toHaveLength(51);
  });

  it('has 28 study days up to Dec 16, then 18 mock-phase days', () => {
    const study = PREP_PLAN.filter((d) => d.week !== null);
    expect(study).toHaveLength(28);
    expect(study.every((d) => d.date <= '2026-12-16')).toBe(true);
    const phase2 = PREP_PLAN.filter((d) => d.week === null && !d.rest);
    expect(phase2).toHaveLength(18);
    expect(phase2[0].date).toBe('2026-12-17');
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

  it('schedules 48 core DSA problems and 12 extension slots, each problem once', () => {
    const dsa = items.filter((i) => i.kind === 'dsa' && i.badge !== 'Revision');
    expect(dsa.filter((i) => i.badge?.startsWith('Core'))).toHaveLength(48);
    expect(dsa.filter((i) => i.badge === 'Extension / revision')).toHaveLength(12);
    expect(new Set(dsa.map((i) => i.title)).size).toBe(60);
  });

  it('keeps Nov 15-19 as originally published', () => {
    expect(day('2026-11-15').items.map((i) => i.id)).toEqual(['2026-11-15.dsa1', '2026-11-15.dsa2', '2026-11-15.lld']);
    expect(day('2026-11-15').items[0].title).toBe('Subarray Sum Equals K');
    expect(day('2026-11-19').items.map((i) => i.title)).toEqual([
      '3Sum',
      'Trapping Rain Water',
      'Fundamentals: Java',
      'LLD drill: Parking Lot',
    ]);
  });

  it('gives six LLD and six HLD exercises two days each', () => {
    expect(items.filter(isMain('lld'))).toHaveLength(12);
    expect(items.filter(isMain('hld'))).toHaveLength(12);
    expect(day('2026-11-20').items.find((i) => i.kind === 'lld')?.title).toBe('LLD: Thread-safe LRU Cache');
  });

  it('puts Day 2 of every LLD/HLD exercise the day after Day 1, so none straddles the wedding break', () => {
    for (const kind of ['lld', 'hld']) {
      const mains = items.filter(isMain(kind));
      for (let i = 0; i < mains.length; i += 2) {
        expect(mains[i].badge).toMatch(/Day 1\/2/);
        expect(mains[i + 1].badge).toMatch(/Day 2\/2/);
        expect(mains[i + 1].date).toBe(addDays(mains[i].date, 1));
        expect(mains[i + 1].title).toBe(mains[i].title);
      }
    }
  });

  it('puts all 12 mocks at the end, from Dec 17', () => {
    const mocks = items.filter((i) => i.kind === 'mock');
    expect(mocks).toHaveLength(12);
    expect(mocks.every((m) => m.date >= '2026-12-17')).toBe(true);
    expect(PREP_PLAN.filter((d) => d.week !== null).some((d) => d.items.some((i) => i.kind === 'mock'))).toBe(false);
  });

  it('keeps one fundamentals session per subject, in the weekly order, six in total', () => {
    const fund = items.filter((i) => i.kind === 'fundamentals');
    expect(fund.map((f) => f.title)).toEqual([
      'Fundamentals: Java',
      'Fundamentals: Databases',
      'Fundamentals: Spring Boot',
      'Fundamentals: Distributed Systems',
      'Fundamentals: Kafka',
      'Fundamentals: Production Engineering',
    ]);
  });

  it('covers all 8 STAR stories', () => {
    const stories = items.filter((i) => i.kind === 'behavioral' && i.steps.length);
    expect(stories.flatMap((i) => i.steps)).toHaveLength(8);
  });
});

describe('plan content', () => {
  const items = PREP_PLAN.flatMap((d) => d.items.map((i) => ({ ...i, date: d.date })));

  it('has no recruiting or project items', () => {
    expect(items.filter((i) => !['dsa', 'lld', 'hld', 'fundamentals', 'behavioral', 'mock', 'review'].includes(i.kind))).toEqual([]);
    expect(items.filter((i) => /recruit|project|application|referral/i.test(`${i.title} ${i.detail ?? ''}`))).toEqual([]);
  });

  it('keeps all behavioral work on or after Dec 21, with every story drafted before Dec 30', () => {
    const behavioral = items.filter((i) => i.kind === 'behavioral' || /behavioral/i.test(i.title));
    expect(behavioral.length).toBeGreaterThan(0);
    expect(behavioral.every((i) => i.date >= '2026-12-21')).toBe(true);
    const drafts = items.filter((i) => i.id.endsWith('.star')).sort((a, b) => (a.date < b.date ? -1 : 1));
    expect(drafts.map((d) => d.date)).toEqual(['2026-12-21', '2026-12-22', '2026-12-25', '2026-12-27']);
    expect(drafts.flatMap((d) => d.steps)).toHaveLength(8);
    expect(drafts[drafts.length - 1].date < '2026-12-30').toBe(true);
    expect(items.find((i) => i.id === '2027-01-04.bmock')).toBeDefined();
  });

  it('gives every item a positive planned time', () => {
    expect(items.every((i) => Number.isInteger(i.minutes) && i.minutes > 0)).toBe(true);
  });

  it('keeps every day realistic: 2-2.5 h of practice, 1.5-2.5 h on mock days and the last days', () => {
    for (const d of PREP_PLAN.filter((x) => !x.rest)) {
      const min = dayMinutes(d);
      const lenient = d.items.some((i) => i.kind === 'mock') || d.date >= '2027-01-04';
      expect([d.date, min >= (lenient ? 90 : 120) && min <= 150]).toEqual([d.date, true]);
    }
  });

  it('schedules all 8 design drills, each with individual checkboxes', () => {
    const drills = items.filter((i) => /^(dl|dh)$/.test(i.id.split('.')[1]));
    expect(drills.map((i) => i.title)).toEqual([
      'LLD drill: Parking Lot',
      'HLD drill: URL Shortener',
      'LLD drill: Splitwise',
      'HLD drill: Distributed Cache',
      'HLD drill: News Feed',
      'LLD drill: Elevator',
      'HLD drill: Log Aggregation / Metrics Pipeline',
      'LLD drill: Cab Booking',
    ]);
    // Regression: drills used to be a single checkbox.
    for (const d of drills) expect(d.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('has Yellow/Red DSA revision in the mock phase', () => {
    const rev = items.filter((i) => i.id.endsWith('.rev'));
    expect(rev.length).toBeGreaterThan(0);
    expect(rev.every((i) => i.date >= '2026-12-17')).toBe(true);
  });

  it('formats minutes', () => {
    expect(formatMinutes(145)).toBe('2h 25m');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(45)).toBe('45m');
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
    // Dec 18 (DSA mock) and Dec 17 are unfinished; looking from Dec 19.
    const a = agendaFor('2026-12-19', '2026-12-19', new Set());
    expect(a.carried.some((c) => c.item.kind === 'mock')).toBe(false);
    expect(a.carried.some((c) => c.from === '2026-12-17')).toBe(true);
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
