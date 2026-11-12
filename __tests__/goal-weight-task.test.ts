import { caloriesOverGoal, defaultMealRoutine, goalLabel, mealFraction, goalProgress, mealGoalMet, mealGoalReached, MEAL_CALORIE_SLACK, MEAL_PROTEIN_SLACK, stepFraction } from '@/domain/goal';
import { dayProgress, overdueTasks, taskCounts, tasksOn } from '@/domain/task';
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
    expect(goalProgress({ type: 'protein', target: 100 }, 0, false, 42.26)).toBe('42.3 / 100 g protein');
    expect(goalProgress({ type: 'steps', target: 8000 }, 100, false)).toBe('Auto · 8,000 steps');
    expect(goalProgress({ type: 'steps', target: 8000 }, 8100, true)).toBe('8,100 / 8,000 steps');
  });

  it('shows no progress text for strength routines on the daily views', () => {
    expect(goalProgress({ type: 'workout' }, 0, true)).toBe('');
    expect(goalProgress({ type: 'workout' }, 0, false)).toBe('');
  });
});

describe('caloriesOverGoal', () => {
  it('is not over within the slack, in either direction', () => {
    expect(caloriesOverGoal(1850, 2000)).toBe(false);
    expect(caloriesOverGoal(2000, 2000)).toBe(false);
    expect(caloriesOverGoal(2150, 2000)).toBe(false);
  });
  it('is over only beyond the slack', () => {
    expect(caloriesOverGoal(2151, 2000)).toBe(true);
  });
});

describe('meal goal', () => {
  const g = { type: 'meal', calories: 2000, proteinG: 150 } as const;
  const met = (calories: number, proteinG: number) => mealGoalMet(g, { calories, proteinG });

  it('has the agreed slack', () => {
    expect(MEAL_CALORIE_SLACK).toBe(150);
    expect(MEAL_PROTEIN_SLACK).toBe(15);
  });

  it('passes on target, under calories, and over protein', () => {
    expect(met(2000, 150)).toBe(true);
    expect(met(1500, 200)).toBe(true);
  });

  it('allows up to +150 kcal and -15 g protein', () => {
    expect(met(2150, 150)).toBe(true);
    expect(met(2000, 135)).toBe(true);
    expect(met(2150, 135)).toBe(true);
  });

  it('fails major misses', () => {
    expect(met(2151, 150)).toBe(false);
    expect(met(2000, 134)).toBe(false);
    expect(met(0, 0)).toBe(false); // nothing logged
  });

  describe('reached today (live check)', () => {
    const reached = (calories: number, proteinG: number) => mealGoalReached(g, { calories, proteinG });

    it('ticks once calories and protein both hit the targets', () => {
      expect(reached(2000, 150)).toBe(true);
      expect(reached(2100, 160)).toBe(true);
    });

    it('does not tick while either is below target (no slack on the way up)', () => {
      expect(reached(1999, 150)).toBe(false);
      expect(reached(2000, 149)).toBe(false);
      expect(reached(1850, 150)).toBe(false);
      expect(reached(0, 0)).toBe(false);
    });

    it('does not tick once calories are past the slack', () => {
      expect(reached(2150, 150)).toBe(true);
      expect(reached(2151, 150)).toBe(false);
    });
  });

  it('builds the default everyday routine from the Meals goals', () => {
    expect(defaultMealRoutine({ calories: 1900, proteinG: 140, carbsG: 200 })).toEqual({
      title: 'Hit meal goal',
      recurrence: { type: 'daily' },
      goal: { type: 'meal', calories: 1900, proteinG: 140 },
    });
  });

  it('clamps protein progress', () => {
    expect(mealFraction(g, 75)).toBe(0.5);
    expect(mealFraction(g, 400)).toBe(1);
    expect(mealFraction({ type: 'steps', target: 1 }, 10)).toBe(0);
  });

  it('labels and describes progress', () => {
    expect(goalLabel(g)).toBe('2,000 kcal · 150 g protein');
    expect(goalProgress(g, 0, false, 120.44, 1850.2)).toBe('1,850 / 2,000 kcal · 120.4 / 150 g protein');
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

describe('dayProgress', () => {
  const mk = (id: string, completedAt: string | null = null): Task => ({ id, title: id, date: '2026-01-01', createdAt: '', completedAt });
  it('counts tasks together with routines', () => {
    
    expect(dayProgress(1, 2, [mk('a', '2026-01-01T00:00:00Z'), mk('b')], [mk('c')])).toEqual({ done: 2, total: 5, fraction: 0.4 });
    expect(dayProgress(0, 0, [], [])).toEqual({ done: 0, total: 0, fraction: 0 });
  });
});
