import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ElapsedClock } from '@/components/workouts/ElapsedClock';
import { completedSets } from '@/domain/session';
import { useWorkoutSession } from '@/store/useWorkoutSession';
import { radius, useTheme } from '@/theme';

/** "Workout in progress" strip; tap to go back to logging. Renders nothing when no workout is open. */
export function ActiveWorkoutBanner() {
  const t = useTheme();
  const workout = useWorkoutSession((s) => (s.mode === 'live' ? s.workout : null));
  if (!workout) return null;
  return (
    <Pressable
      onPress={() => router.push('/workout' as Href)}
      style={[styles.banner, { backgroundColor: t.accent }]}
      accessibilityRole="button"
      accessibilityLabel={`Workout in progress: ${workout.title}. Tap to resume.`}
    >
      <Ionicons name="barbell" size={22} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {workout.title}
        </Text>
        <Text style={styles.sub}>
          <ElapsedClock startedAt={workout.startedAt} style={styles.sub} /> · {completedSets(workout)} sets done
        </Text>
      </View>
      <Text style={styles.resume}>Resume</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.lg, marginBottom: 12 },
  title: { color: '#fff', fontWeight: '800', fontSize: 16 },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  resume: { color: '#fff', fontWeight: '800' },
});
