import { goalLabel, goalProgress, stepFraction } from '@/domain/goal';
import { overdueTasks, taskCounts, tasksOn } from '@/domain/task';
import type { Task } from '@/domain/types';
import { weekStart, weeklyAverages } from '@/domain/weight';

describe('goals', () => {
  it('labels goals', () => {
    expect(goalLabel({ type: 'steps', target: 10000 })).toBe('10,000 steps');
    expect(goalLabel({ type: 'protein', target: 120 })).toBe('120 g protein');
    expect(goalLabel({ type: 'workout' })).toBe('Strength training');
  });

  it('clamps step fraction and ignores bad input', () => {
    expect(stepFraction({ type: 'steps', target: 10000 }, 5000)).toBe(0.5);
    expect(stepFraction({ type: 'steps', target: 10000 }, 99999)).toBe(1);
    expect(stepFraction({ type: 'steps', target: 0 }, 10)).toBe(0);
    expect(stepFraction({ type: 'workout' }, 10)).toBe(0);
  });

  it('describes progress', () => {
    expect(goalProgress({ type: 'protein', target: 100 }, 0, 0, false, 42.26)).toBe('42.3 / 100 g protein');
    expect(goalProgress({ type: 'steps', target: 8000 }, 100, 0, false)).toBe('Auto · 8,000 steps');
    expect(goalProgress({ type: 'steps', target: 8000 }, 8100, 0, true)).toBe('8,100 / 8,000 steps');
    expect(goalProgress({ type: 'workout' }, 0, 2, true)).toBe('2 strength workouts logged');
    expect(goalProgress({ type: 'workout' }, 0, 0, true)).toBe('No strength workout logged yet');
  });
});

describe('weight', () => {
  it('uses Sunday as week start', () => {
    expect(weekStart('2026-11-07')).toBe('2026-11-01'); // Saturday -> Sunday
    expect(weekStart('2026-11-01')).toBe('2026-11-01');
  });

  it('averages per week, skips empty weeks and old entries', () => {
    const out = weeklyAverages(
      [
        { date: '2026-11-01', kg: 80 },
        { date: '2026-11-03', kg: 82 },
        { date: '2026-10-20', kg: 90 },
        { date: '2025-01-01', kg: 100 }, // outside window
      ],
      '2026-11-07',
      4,
    );
    expect(out).toEqual([
      { weekStart: '2026-10-18', avg: 90, count: 1 },
      { weekStart: '2026-11-01', avg: 81, count: 2 },
    ]);
  });
});

describe('tasks', () => {
  const t = (id: string, date: string, completedAt: string | null = null): Task => ({
    id,
    title: id,
    date,
    createdAt: '2026-11-01T00:00:00.000Z',
    completedAt,
  });
  const today = '2026-11-07';

  it('filters by day', () => {
    expect(tasksOn([t('a', today), t('b', '2026-11-08')], today).map((x) => x.id)).toEqual(['a']);
  });

  it('keeps open overdue tasks and ones ticked today only', () => {
    const doneToday = new Date(2026, 10, 7, 9).toISOString();
    const doneEarlier = new Date(2026, 10, 3, 9).toISOString();
    const out = overdueTasks(
      [t('open', '2026-11-05'), t('doneToday', '2026-11-05', doneToday), t('doneOld', '2026-11-05', doneEarlier), t('future', '2026-11-09')],
      today,
    );
    expect(out.map((x) => x.id)).toEqual(['open', 'doneToday']);
  });

  it('counts total and open per day', () => {
    const c = taskCounts([t('a', today), t('b', today, '2026-11-07T10:00:00.000Z')]);
    expect(c.get(today)).toEqual({ total: 2, open: 1 });
  });
});
