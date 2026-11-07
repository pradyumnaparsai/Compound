import { completionKey, currentStreak, dayStatus, isScheduled, recurrenceLabel, toDoneSet } from '@/domain/recurrence';
import type { Routine } from '@/domain/types';

const routine = (over: Partial<Routine> = {}): Routine => ({
  id: 'r1',
  title: 'Read',
  recurrence: { type: 'daily' },
  goal: null,
  reminderTime: null,
  createdAt: '2026-11-01',
  archivedAt: null,
  ...over,
});

describe('isScheduled', () => {
  it('is false before creation and from the archive day on', () => {
    const r = routine({ archivedAt: '2026-11-05' });
    expect(isScheduled(r, '2026-10-31')).toBe(false);
    expect(isScheduled(r, '2026-11-04')).toBe(true);
    expect(isScheduled(r, '2026-11-05')).toBe(false);
  });

  it('respects weekly days', () => {
    const r = routine({ recurrence: { type: 'weekly', days: [1, 3] } }); // Mon, Wed
    expect(isScheduled(r, '2026-11-02')).toBe(true); // Monday
    expect(isScheduled(r, '2026-11-03')).toBe(false); // Tuesday
  });
});

describe('dayStatus', () => {
  const routines = [routine({ id: 'a' }), routine({ id: 'b' })];
  it('reports empty / none / partial / all', () => {
    const d = '2026-11-03';
    expect(dayStatus([], new Set(), d)).toBe('empty');
    expect(dayStatus(routines, new Set(), d)).toBe('none');
    expect(dayStatus(routines, new Set([completionKey('a', d)]), d)).toBe('partial');
    expect(dayStatus(routines, new Set([completionKey('a', d), completionKey('b', d)]), d)).toBe('all');
  });

  it('builds the done set from completions', () => {
    expect(toDoneSet([{ routineId: 'a', date: '2026-11-03' }]).has('a|2026-11-03')).toBe(true);
  });
});

describe('currentStreak', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date(2026, 10, 7, 12) }));
  afterEach(() => jest.useRealTimers());

  const r = routine({ createdAt: '2026-11-01' });
  const done = (...dates: string[]) => new Set(dates.map((d) => completionKey('r1', d)));

  it('counts consecutive complete days including today', () => {
    expect(currentStreak([r], done('2026-11-05', '2026-11-06', '2026-11-07'))).toBe(3);
  });

  it('does not break when today is still in progress', () => {
    expect(currentStreak([r], done('2026-11-05', '2026-11-06'))).toBe(2);
  });

  it('breaks on a missed past day', () => {
    expect(currentStreak([r], done('2026-11-04', '2026-11-06', '2026-11-07'))).toBe(2);
  });

  it('is 0 without routines', () => {
    expect(currentStreak([], new Set())).toBe(0);
  });
});

describe('recurrenceLabel', () => {
  it('labels daily, all-days and sorted weekdays', () => {
    expect(recurrenceLabel({ type: 'daily' })).toBe('Every day');
    expect(recurrenceLabel({ type: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('Every day');
    expect(recurrenceLabel({ type: 'weekly', days: [5, 1] })).toBe('Mon · Fri');
  });
});
