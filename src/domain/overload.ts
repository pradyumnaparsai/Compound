// Progressive-overload hints, warm-up ramps and loadable-weight rounding. Pure functions; opt-in per exercise.
import { KG_PER_LB, type WeightUnit } from './units';

export type PlateConfig = {
  /** Empty bar weight (kg). */
  barKg: number;
  /** Plate sizes (kg), heaviest first; one pair is loaded at a time, so the smallest step is 2 × the lightest plate. */
  platesKg: number[];
};

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5].map((p) => p * KG_PER_LB);

export const defaultPlateConfig = (unit: WeightUnit): PlateConfig =>
  unit === 'kg' ? { barKg: 20, platesKg: [...KG_PLATES] } : { barKg: 45 * KG_PER_LB, platesKg: [...LB_PLATES] };

/** Smallest weight jump available with this setup (a pair of the lightest plates). */
export const smallestStepKg = (c: PlateConfig) => 2 * Math.min(...c.platesKg);

/** Nearest weight that can actually be loaded on the bar. At or under the bar it is returned unchanged. */
export function roundToLoadable(kg: number, c: PlateConfig): number {
  if (!(kg > c.barKg)) return kg;
  const step = smallestStepKg(c);
  return c.barKg + Math.round((kg - c.barKg) / step) * step;
}

/** Rounds to 3 decimals so converted lb weights compare cleanly. */
const tidy = (n: number) => Math.round(n * 1000) / 1000;

export type RepRange = { min: number; max: number };
export type PastSet = { weightKg: number | null; reps: number | null; setType: string; isCompleted?: boolean };

export type Suggestion = {
  weightKg: number;
  reason: 'increase' | 'decrease' | 'keep';
  message: string;
};

/**
 * Next-session weight from the last session's completed working sets (warm-ups ignored), judged at the
 * heaviest working weight: every set reached the top of the rep range → add the smallest step; any set fell
 * below the bottom of the range → drop one step; otherwise keep it. Null when there is nothing to judge.
 */
export function suggestNextWeight(
  lastSets: PastSet[],
  range: RepRange,
  plates: PlateConfig,
  stepKg: number = smallestStepKg(plates),
): Suggestion | null {
  const working = lastSets.filter((s) => s.isCompleted !== false && s.setType !== 'warmup' && (s.weightKg ?? 0) > 0 && (s.reps ?? 0) > 0);
  if (working.length === 0 || range.min <= 0 || range.max < range.min) return null;
  const top = Math.max(...working.map((s) => s.weightKg as number));
  const atTop = working.filter((s) => s.weightKg === top);
  const minReps = Math.min(...atTop.map((s) => s.reps as number));
  if (minReps >= range.max) {
    return {
      weightKg: tidy(roundToLoadable(top + stepKg, plates)),
      reason: 'increase',
      message: 'Weight increased after reaching your rep goal.',
    };
  }
  if (minReps < range.min) {
    const lowered = Math.max(0, top - stepKg);
    return {
      weightKg: tidy(lowered > plates.barKg ? roundToLoadable(lowered, plates) : lowered),
      reason: 'decrease',
      message: 'Weight adjusted since you fell below your target reps.',
    };
  }
  return { weightKg: top, reason: 'keep', message: 'Same weight: keep working toward the top of your rep range.' };
}

export type WarmupStep = { pct: number; reps: number };
export const DEFAULT_WARMUP_RAMP: WarmupStep[] = [
  { pct: 0.4, reps: 8 },
  { pct: 0.6, reps: 5 },
  { pct: 0.8, reps: 3 },
];

/**
 * Warm-up sets as a percentage ramp off the working weight, rounded to loadable weights. Steps that round to
 * the empty bar or lower are merged into a single bar set; steps that round up to the working weight (or
 * duplicate the previous step) are dropped. Empty when the working weight is at most the bar.
 */
export function warmupSets(workingKg: number, plates: PlateConfig, ramp: WarmupStep[] = DEFAULT_WARMUP_RAMP): { weightKg: number; reps: number }[] {
  if (!(workingKg > plates.barKg)) return [];
  const out: { weightKg: number; reps: number }[] = [];
  for (const step of ramp) {
    const w = tidy(Math.max(plates.barKg, roundToLoadable(workingKg * step.pct, plates)));
    if (w >= workingKg) continue;
    if (out.length > 0 && out[out.length - 1].weightKg >= w) continue;
    out.push({ weightKg: w, reps: step.reps });
  }
  return out;
}
