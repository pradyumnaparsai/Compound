import { Platform } from 'react-native';
import { sameActivityProps, workoutActivityProps, type WorkoutActivityProps } from '@/domain/workoutActivity';
import type { Workout } from '@/domain/workout';

type Activity = { update(props: WorkoutActivityProps): Promise<void>; end(policy?: 'default' | 'immediate'): Promise<void> };
type Factory = { start(props: WorkoutActivityProps, url?: string): Activity; getInstances(): Activity[] };

/** undefined = never synced, so the first call always reconciles (e.g. ends an activity left over from a killed app). */
let last: WorkoutActivityProps | null | undefined;
let queue: Promise<void> = Promise.resolve();

/** Lazy: the native module is missing in Expo Go and in builds made before the Live Activity was added. */
function factory(): Factory | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('@/widgets/WorkoutActivity').default as Factory) ?? null;
  } catch (e) {
    if (__DEV__) console.warn('Live Activity unavailable (needs a native rebuild):', e);
    return null;
  }
}

/**
 * Mirrors the workout being logged to a Live Activity (lock screen + Dynamic Island) so you can see from
 * anywhere that one is still open. Starts it, keeps it current, and ends it when the workout is finished or
 * discarded. Never throws: a missing native module or a refusal by iOS must not break workout logging.
 */
export function syncWorkoutActivity(workout: Workout | null | undefined) {
  const props = workoutActivityProps(workout);
  if (last !== undefined && sameActivityProps(props, last)) return;
  last = props;
  queue = queue
    .then(async () => {
      const f = factory();
      if (!f) return;
      const instances = f.getInstances();
      if (!props) {
        await Promise.all(instances.map((a) => a.end('immediate')));
        return;
      }
      if (instances.length === 0) {
        f.start(props); // no deep link: a cold-start into /workout would render before the workout is loaded
        return;
      }
      const [keep, ...extra] = instances;
      await Promise.all(extra.map((a) => a.end('immediate'))); // never more than one
      await keep.update(props);
    })
    .catch((e) => {
      last = undefined; // retry on the next change
      if (__DEV__) console.warn('Live Activity sync failed:', e);
    });
}
