import type { SavedMeal } from '@/domain/meal';
import {
  dateToTime,
  dueSchedules,
  editSchedule,
  formatDays,
  formatTime,
  mealFromTemplate,
  parseTime,
  templateFromItems,
  timeToDate,
  type MealSchedule,
} from '@/domain/mealSchedule';

const sched = (over: Partial<MealSchedule> = {}): MealSchedule => ({
  id: 's1',
  savedMealId: 'm1',
  time: '08:00',
  days: null,
  enabled: true,
  createdAt: new Date(2026, 10, 1, 9, 0).toISOString(), // Sun 1 Nov, after 08:00
  lastApplied: null,
  ...over,
});

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m); // Nov 2026: 1 = Sunday, 7 = Saturday

const ing = { name: 'Whey', estimated_quantity: '30 g', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5 };
const tpl: SavedMeal = {
  id: 'm1',
  title: 'Protein shake',
  ingredients: [ing, { ...ing, name: 'Milk', calories: 80, protein_g: 6, carbs_g: 9, fat_g: 2 }],
  calories: 200,
  proteinG: 30,
  carbsG: 12,
  fatG: 3.5,
  createdAt: '2026-10-01T00:00:00.000Z',
};

describe('parseTime', () => {
  it.each([
    ['8', '08:00'],
    ['08:05', '08:05'],
    ['8:5', '08:05'],
    ['0805', '08:05'],
    ['805', '08:05'],
    ['8.30', '08:30'],
    [' 23:59 ', '23:59'],
    ['0:00', '00:00'],
  ])('%s -> %s', (raw, out) => expect(parseTime(raw)).toBe(out));

  it.each(['', 'abc', '24:00', '8:60', '123456', '-1', '8:'])('rejects %p', (raw) => expect(parseTime(raw)).toBeNull());
});

describe('timeToDate / dateToTime', () => {
  it('round-trips HH:mm', () => {
    for (const t of ['00:00', '07:05', '12:30', '23:59']) expect(dateToTime(timeToDate(t))).toBe(t);
  });
  it('keeps the base day and zeroes seconds', () => {
    const d = timeToDate('21:15', new Date(2026, 10, 7, 3, 4, 5, 6));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([2026, 10, 7, 21, 15, 0, 0]);
  });
  it('leaves the base time for invalid input', () => {
    const base = new Date(2026, 10, 7, 3, 4);
    expect(timeToDate('nope', base).getTime()).toBe(base.getTime());
  });
});

describe('format helpers', () => {
  it('formats 12 h times', () => {
    expect(formatTime('00:05')).toBe('12:05 AM');
    expect(formatTime('08:00')).toBe('8:00 AM');
    expect(formatTime('12:30')).toBe('12:30 PM');
    expect(formatTime('21:00')).toBe('9:00 PM');
  });
  it('formats days', () => {
    expect(formatDays(null)).toBe('Every day');
    expect(formatDays([])).toBe('Every day');
    expect(formatDays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(formatDays([5, 1, 3])).toBe('Mon, Wed, Fri');
  });
});

describe('dueSchedules', () => {
  it('is due once the time has passed', () => {
    expect(dueSchedules([sched()], at(2, 8, 0))).toHaveLength(1);
    expect(dueSchedules([sched()], at(2, 23, 59))).toHaveLength(1);
  });
  it('is not due before the time', () => {
    expect(dueSchedules([sched()], at(2, 7, 59))).toHaveLength(0);
  });
  it('skips disabled schedules', () => {
    expect(dueSchedules([sched({ enabled: false })], at(2, 12))).toHaveLength(0);
  });
  it('skips a schedule already applied today but not yesterday', () => {
    expect(dueSchedules([sched({ lastApplied: '2026-11-02' })], at(2, 12))).toHaveLength(0);
    expect(dueSchedules([sched({ lastApplied: '2026-11-01' })], at(2, 12))).toHaveLength(1);
  });
  it('honours weekdays', () => {
    const monWed = sched({ days: [1, 3] });
    expect(dueSchedules([monWed], at(2, 12))).toHaveLength(1); // Monday
    expect(dueSchedules([monWed], at(3, 12))).toHaveLength(0); // Tuesday
    expect(dueSchedules([monWed], at(4, 12))).toHaveLength(1); // Wednesday
  });
  it('treats an empty day list as every day', () => {
    expect(dueSchedules([sched({ days: [] })], at(3, 12))).toHaveLength(1);
  });
  it('does not log an occurrence that was before the schedule was created', () => {
    const s = sched({ createdAt: at(2, 10).toISOString() });
    expect(dueSchedules([s], at(2, 11))).toHaveLength(0); // 08:00 already passed when created at 10:00
    expect(dueSchedules([s], at(3, 8))).toHaveLength(1); // starts the next day
  });
  it('logs when created before the time the same day', () => {
    const s = sched({ createdAt: at(2, 7).toISOString() });
    expect(dueSchedules([s], at(2, 8))).toHaveLength(1);
  });
  it('only considers today, never backfills missed days', () => {
    const s = sched({ lastApplied: '2026-11-01' });
    expect(dueSchedules([s], at(6, 12))).toHaveLength(1); // one result, not one per missed day
  });
  it('returns several due schedules', () => {
    const list = [sched({ id: 'a' }), sched({ id: 'b', time: '12:00' }), sched({ id: 'c', time: '20:00' })];
    expect(dueSchedules(list, at(2, 13)).map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('mealFromTemplate', () => {
  it('stamps the entry at the scheduled time with recomputed totals', () => {
    const m = mealFromTemplate(tpl, { time: '08:00' }, at(2, 9, 30), 'x1', 'Auto');
    expect(m).toMatchObject({
      id: 'x1',
      date: '2026-11-02',
      slot: 'breakfast',
      title: 'Protein shake',
      inputType: 'saved',
      calories: 200,
      proteinG: 30,
      carbsG: 12,
      fatG: 3.5,
      assumptions: ['Auto'],
    });
    expect(new Date(m.loggedAt).getTime()).toBe(at(2, 8).getTime());
  });
  it('picks the slot from the scheduled time, not the run time', () => {
    expect(mealFromTemplate(tpl, { time: '19:00' }, at(2, 23), 'x', 'a').slot).toBe('dinner');
    expect(mealFromTemplate(tpl, { time: '12:30' }, at(2, 23), 'x', 'a').slot).toBe('lunch');
  });
});

describe('templateFromItems', () => {
  it('recomputes totals and trims the title', () => {
    const t = templateFromItems({ id: 'n', createdAt: 'c' }, '  Shake  ', tpl.ingredients);
    expect(t).toMatchObject({ id: 'n', title: 'Shake', calories: 200, proteinG: 30, carbsG: 12, fatG: 3.5, createdAt: 'c' });
  });
  it('falls back to "Meal" and caps long names', () => {
    expect(templateFromItems({ id: 'n', createdAt: 'c' }, '   ', []).title).toBe('Meal');
    expect(templateFromItems({ id: 'n', createdAt: 'c' }, 'x'.repeat(80), []).title).toHaveLength(40);
  });
});

describe('editSchedule', () => {
  const now = at(2, 10).toISOString();
  it('restarts from the next occurrence when the time changes (no immediate log)', () => {
    const e = editSchedule(sched(), { time: '09:00', days: null }, now);
    expect(e.createdAt).toBe(now);
    expect(e.time).toBe('09:00');
    expect(dueSchedules([e], at(2, 10, 5))).toHaveLength(0);
    expect(dueSchedules([e], at(3, 9))).toHaveLength(1);
  });
  it('restarts when the days change', () => {
    expect(editSchedule(sched({ days: [1] }), { time: '08:00', days: [1, 2] }, now).createdAt).toBe(now);
  });
  it('keeps createdAt when nothing changed (every-day spellings are equal)', () => {
    const s = sched({ days: null });
    expect(editSchedule(s, { time: '08:00', days: [] }, now).createdAt).toBe(s.createdAt);
    expect(editSchedule(s, { time: '08:00', days: [0, 1, 2, 3, 4, 5, 6] }, now).createdAt).toBe(s.createdAt);
  });
  it('restarts when re-enabling a disabled schedule', () => {
    const e = editSchedule(sched({ enabled: false }), { time: '08:00', days: null }, now);
    expect(e.enabled).toBe(true);
    expect(e.createdAt).toBe(now);
  });
});
