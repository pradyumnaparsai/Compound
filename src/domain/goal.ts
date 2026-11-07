import type { Goal } from './types';

export const DEFAULT_STEP_TARGET = 10000;

export function goalLabel(g: Goal): string {
  if (g.type === 'steps') return `${g.target.toLocaleString('en-US')} steps`;
  if (g.type === 'protein') return `${g.target} g protein`;
  return 'Strength training';
}

/** 0..1 fraction of a steps goal reached; 0 for non-step goals or bad targets. */
export function stepFraction(g: Goal, steps: number | undefined): number {
  if (g.type !== 'steps' || !(g.target > 0)) return 0;
  return Math.min(1, Math.max(0, (steps ?? 0) / g.target));
}

/** Progress line for a goal routine on a given day. */
export function goalProgress(
  g: Goal,
  steps: number | undefined,
  workouts: number | undefined,
  checked: boolean,
  protein = 0,
): string {
  // Protein comes from the Meals log, so it is always known (no Apple Health permission involved).
  if (g.type === 'protein') return `${Math.round(protein * 10) / 10} / ${g.target} g protein`;
  if (!checked) return `Auto · ${goalLabel(g)}`;
  if (g.type === 'steps') return `${(steps ?? 0).toLocaleString('en-US')} / ${g.target.toLocaleString('en-US')} steps`;
  const n = workouts ?? 0;
  return n > 0 ? `${n} strength workout${n > 1 ? 's' : ''} logged` : 'No strength workout logged yet';
}
