import { addDays, dateParam, dayTitle, fromKey, isDateKey, monthGrid, toKey, weekday } from '@/domain/date';

describe('date helpers', () => {
  it('round-trips keys in local time', () => {
    expect(toKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toKey(fromKey('2026-11-07'))).toBe('2026-11-07');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29'); // leap year
  });

  it('returns Sunday-first weekday numbers', () => {
    expect(weekday('2026-11-08')).toBe(0); // Sunday
    expect(weekday('2026-11-07')).toBe(6); // Saturday
  });

  it('builds a Sunday-first month grid padded with nulls', () => {
    const grid = monthGrid(2026, 10); // November 2026 starts on Sunday
    expect(grid[0][0]).toBe('2026-11-01');
    expect(grid.every((row) => row.length === 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
    expect(grid.flat().slice(-1)[0]).toBeNull();
  });
});

describe('date params', () => {
  afterEach(() => jest.useRealTimers());

  it('validates real date keys only', () => {
    expect(isDateKey('2026-11-09')).toBe(true);
    expect(isDateKey('2026-02-31')).toBe(false);
    expect(isDateKey('2026-2-3')).toBe(false);
    expect(isDateKey(undefined)).toBe(false);
  });

  it('falls back to today for missing or invalid params', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 9, 12) });
    expect(dateParam(undefined)).toBe('2026-11-09');
    expect(dateParam('garbage')).toBe('2026-11-09');
    expect(dateParam('2026-11-10')).toBe('2026-11-10');
    expect(dateParam(['2026-11-08', 'x'])).toBe('2026-11-08');
  });

  it('titles days relative to today', () => {
    expect(dayTitle('2026-11-09', '2026-11-09')).toBe('Today');
    expect(dayTitle('2026-11-08', '2026-11-09')).toBe('Yesterday');
    expect(dayTitle('2026-11-10', '2026-11-09')).toBe('Tomorrow');
    expect(dayTitle('2026-11-20', '2026-11-09')).not.toMatch(/Today|Tomorrow|Yesterday/);
  });
});
