import type { Goals } from './meal';
import type { Goal, RoutineInput } from './types';

export const DEFAULT_STEP_TARGET = 10000;

/** Slack on the daily meal goal: calories may exceed the target by this much, protein may fall short by this much. */
export const MEAL_CALORIE_SLACK = 150;
export const MEAL_PROTEIN_SLACK = 15;

/** The everyday meal-goal routine, snapshotting the current Meals calorie/protein goals. */
export function defaultMealRoutine(goals: Goals): RoutineInput {
  return {
    title: 'Hit meal goal',
    recurrence: { type: 'daily' },
    goal: { type: 'meal', calories: goals.calories, proteinG: goals.proteinG },
  };
}

/** True only when calories exceed the target by more than the slack: a few calories over is not a miss. */
export const caloriesOverGoal = (calories: number, target: number): boolean => calories > target + MEAL_CALORIE_SLACK;

/** 0..1 protein progress toward a meal goal (drives the progress ring). */
export function mealFraction(g: Goal, proteinG: number): number {
  if (g.type !== 'meal' || !(g.proteinG > 0)) return 0;
  return Math.min(1, Math.max(0, proteinG / g.proteinG));
}

/** True when a day's logged totals are within the meal goal's slack. Larger misses fail. */
export function mealGoalMet(
  g: Extract<Goal, { type: 'meal' }>,
  totals: { calories: number; proteinG: number },
): boolean {
  return totals.calories <= g.calories + MEAL_CALORIE_SLACK && totals.proteinG >= g.proteinG - MEAL_PROTEIN_SLACK;
}

export function goalLabel(g: Goal): string {
  if (g.type === 'steps') return `${g.target.toLocaleString('en-US')} steps`;
  if (g.type === 'protein') return `${g.target} g protein`;
  if (g.type === 'meal') return `${g.calories.toLocaleString('en-US')} kcal · ${g.proteinG} g protein`;
  return 'Strength training';
}

/** 0..1 fraction of a steps goal reached; 0 for non-step goals or bad targets. */
export function stepFraction(g: Goal, steps: number | undefined): number {
  if (g.type !== 'steps' || !(g.target > 0)) return 0;
  return Math.min(1, Math.max(0, (steps ?? 0) / g.target));
}

/** Progress line for a goal routine on a given day. Strength routines have none (the Routines screen labels them). */
export function goalProgress(
  g: Goal,
  steps: number | undefined,
  checked: boolean,
  protein = 0,
  calories = 0,
): string {
  if (g.type === 'workout') return '';
  if (g.type === 'meal') {
    return `${Math.round(calories).toLocaleString('en-US')} / ${g.calories.toLocaleString('en-US')} kcal · ${Math.round(protein * 10) / 10} / ${g.proteinG} g protein`;
  }
  // Protein comes from the Meals log, so it is always known (no Apple Health permission involved).
  if (g.type === 'protein') return `${Math.round(protein * 10) / 10} / ${g.target} g protein`;
  if (!checked) return `Auto · ${goalLabel(g)}`;
  return `${(steps ?? 0).toLocaleString('en-US')} / ${g.target.toLocaleString('en-US')} steps`;
}
