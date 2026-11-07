// Apple Health access (UC2). iOS dev/release build only: the native module is absent in Expo Go,
// so everything is lazy and fails soft (returns null) instead of crashing.
import { Platform } from 'react-native';
import { addDays, fromKey, toKey } from '@/domain/date';

const STEPS = 'HKQuantityTypeIdentifierStepCount';
const WORKOUT = 'HKWorkoutTypeIdentifier';

type HK = typeof import('@kingstinct/react-native-healthkit');

let hk: HK | null | undefined;
function lib(): HK | null {
  if (Platform.OS !== 'ios') return null;
  if (hk === undefined) {
    try {
      hk = require('@kingstinct/react-native-healthkit') as HK;
    } catch {
      hk = null;
    }
  }
  return hk;
}

let authorized: Promise<boolean> | null = null;

/**
 * Must run before any query: querying an unrequested type crashes the app.
 * Safe to call repeatedly; iOS only prompts the first time. Note iOS never tells us whether READ access
 * was granted, so denied access just looks like zero data.
 */
export function ensureHealthAuthorized(): Promise<boolean> {
  if (!authorized) {
    authorized = (async () => {
      const h = lib();
      if (!h) return false;
      try {
        if (!(await h.isHealthDataAvailable())) return false;
        await h.requestAuthorization({ toRead: [STEPS, WORKOUT] });
        return true;
      } catch (e) {
        if (__DEV__) console.warn('HealthKit authorization failed', e);
        return false;
      }
    })();
    authorized.then((ok) => {
      if (!ok) authorized = null; // allow a retry next refresh
    });
  }
  return authorized;
}

/** Daily step totals for [fromDate, toDate] (inclusive, local dates). HealthKit statistics de-duplicate iPhone + Watch. */
export async function getDailySteps(fromDate: string, toDate: string): Promise<Record<string, number> | null> {
  const h = lib();
  if (!h || !(await ensureHealthAuthorized())) return null;
  try {
    const start = fromKey(fromDate);
    const end = fromKey(addDays(toDate, 1));
    const rows = await h.queryStatisticsCollectionForQuantity(
      STEPS,
      ['cumulativeSum'],
      start, // anchor at local midnight of the first day
      { day: 1 },
      { filter: { date: { startDate: start, endDate: end } }, unit: 'count' },
    );
    const out: Record<string, number> = {};
    for (const r of rows) {
      if (r.startDate) out[toKey(r.startDate)] = Math.round(r.sumQuantity?.quantity ?? 0);
    }
    return out;
  } catch (e) {
    if (__DEV__) console.warn('Reading steps failed', e);
    return null;
  }
}

/** Number of Traditional Strength Training workouts logged per local day for [fromDate, toDate]. Other workout types are ignored. */
export async function getWorkoutCounts(fromDate: string, toDate: string): Promise<Record<string, number> | null> {
  const h = lib();
  if (!h || !(await ensureHealthAuthorized())) return null;
  try {
    const workouts = await h.queryWorkoutSamples({
      filter: {
        workoutActivityType: h.WorkoutActivityType.traditionalStrengthTraining,
        date: { startDate: fromKey(fromDate), endDate: fromKey(addDays(toDate, 1)) },
      },
      limit: -1,
    });
    const out: Record<string, number> = {};
    for (const w of workouts) {
      if (w.workoutActivityType !== h.WorkoutActivityType.traditionalStrengthTraining) continue;
      const k = toKey(w.startDate);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  } catch (e) {
    if (__DEV__) console.warn('Reading workouts failed', e);
    return null;
  }
}
