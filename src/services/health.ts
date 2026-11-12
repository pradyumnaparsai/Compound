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
        // toShare lets us write the finished strength workout to Health (needs NSHealthUpdateUsageDescription in the build).
        await h.requestAuthorization({ toShare: [WORKOUT], toRead: [STEPS, WORKOUT] });
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

/** Saves a finished Traditional Strength Training workout to Apple Health (shows up in Fitness). False if it could not be saved. */
export async function saveStrengthWorkout(start: Date, end: Date): Promise<boolean> {
  const h = lib();
  if (!h || !(await ensureHealthAuthorized())) return false;
  try {
    if (!(end.getTime() > start.getTime())) return false;
    await h.saveWorkoutSample(h.WorkoutActivityType.traditionalStrengthTraining, [], start, end);
    return true;
  } catch (e) {
    if (__DEV__) console.warn('Saving workout to Health failed', e);
    return false;
  }
}

/**
 * Best effort: asks the paired Apple Watch to open a strength-training workout. iOS only does this for an app that has a
 * watchOS companion, so without one it simply fails and we ignore it.
 */
export async function nudgeWatchStrengthWorkout(): Promise<boolean> {
  const h = lib();
  if (!h || !(await ensureHealthAuthorized())) return false;
  try {
    return await h.startWatchApp({
      activityType: h.WorkoutActivityType.traditionalStrengthTraining,
      locationType: h.WorkoutSessionLocationType.indoor,
    });
  } catch {
    return false;
  }
}

/**
 * Native bridge to a live iPhone workout session (modules/compound-workout-session, iOS 26+): a Traditional Strength
 * Training HKWorkoutSession that runs while the workout is logged; ending it writes the workout to Health.
 */
type LiveSessionModule = {
  start(startedAtMs: number): Promise<boolean>;
  finish(endedAtMs: number): Promise<boolean>;
  discard(): Promise<void>;
};

let live: LiveSessionModule | null | undefined;
function liveModule(): LiveSessionModule | null {
  if (Platform.OS !== 'ios') return null;
  if (live === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { requireOptionalNativeModule } = require('expo') as typeof import('expo');
      live = requireOptionalNativeModule<LiveSessionModule>('CompoundWorkoutSession');
    } catch {
      live = null;
    }
  }
  return live;
}

// finish/discard wait for a start still in flight, so a very quick finish cannot leave a session running.
let starting: Promise<boolean> | null = null;

/** Starts the live iPhone workout session at `startedAt`. False when unsupported (older iOS, Expo Go) or refused. */
export function startLiveStrengthSession(startedAt: Date): Promise<boolean> {
  const m = liveModule();
  if (!m) return Promise.resolve(false);
  // Assigned synchronously, before the authorization await, so finish/discard can never slip in ahead of the start.
  const run = (async () => {
    if (!(await ensureHealthAuthorized())) return false;
    return await m.start(startedAt.getTime());
  })().catch(() => false);
  starting = run;
  return run;
}

/** Ends the live session and saves it to Health. False when there was none (so the caller writes the workout itself). */
export async function finishLiveStrengthSession(endedAt: Date): Promise<boolean> {
  const m = liveModule();
  if (!m) return false;
  try {
    await starting;
    return await m.finish(endedAt.getTime());
  } catch {
    return false;
  }
}

/** Ends the live session without saving anything (workout cancelled, or not worth recording). */
export async function discardLiveStrengthSession(): Promise<void> {
  const m = liveModule();
  if (!m) return;
  try {
    await starting;
    await m.discard();
  } catch {
    /* nothing running */
  }
}
