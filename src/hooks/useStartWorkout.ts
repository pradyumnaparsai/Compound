import { router, type Href } from 'expo-router';
import { Alert } from 'react-native';
import { notifyError } from '@/components/notify';
import type { WorkoutTemplate } from '@/domain/workout';
import { onTemplateWorkoutStarted } from '@/services/workoutHealth';
import { useWorkoutSession } from '@/store/useWorkoutSession';

/** Starts a workout from a template (nudging the Apple Watch) and opens the logger; resumes the one in progress instead of starting a second. */
export function startWorkout(template: WorkoutTemplate | null) {
  const s = useWorkoutSession.getState();
  const open = () => router.push('/workout' as Href);
  if (s.workout && s.mode === 'live') {
    Alert.alert('Workout in progress', `“${s.workout.title}” is still open. Finish or cancel it before starting another.`, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Resume it', onPress: open },
    ]);
    return;
  }
  s.startFromTemplate(template)
    .then(() => {
      if (template) onTemplateWorkoutStarted(new Date(useWorkoutSession.getState().workout?.startedAt ?? Date.now()));
      open();
    })
    .catch((e) => notifyError(e, 'Could not start workout', 'Could not start the workout. Please try again.'));
}
