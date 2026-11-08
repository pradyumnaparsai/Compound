import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ExerciseThumb } from '@/components/workouts/ExerciseThumb';
import { exerciseMap } from '@/domain/exerciseCatalog';
import { weightOn } from '@/domain/weight';
import { workoutDurationSeconds, formatDuration, workoutVolume, completedSetCount, type Workout } from '@/domain/workout';
import { formatDateLabel, formatVolume } from '@/domain/workoutFormat';
import { useUnitStore } from '@/store/useUnitStore';
import { useWeightStore } from '@/store/useWeightStore';
import { useWorkoutHistory } from '@/store/useWorkoutHistory';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { radius, useTheme } from '@/theme';

/** Logged workouts, newest first. Tap one for details, PRs, edit and delete. */
export function HistoryPanel() {
  const t = useTheme();
  const { recent, hasMore, loadMore, ready } = useWorkoutHistory();
  const customs = useWorkoutLibraryStore((s) => s.customs);
  const weights = useWeightStore((s) => s.entries);
  const { unit, warmupVolume } = useUnitStore();
  const defs = useMemo(() => exerciseMap(customs), [customs]);
  const year = new Date().getFullYear();

  const stats = (w: Workout) => ({
    volume: workoutVolume(w, (id) => defs.get(id)?.type, { includeWarmup: warmupVolume, bodyweightKg: weightOn(weights, w.date) }),
    sets: completedSetCount(w, true),
    secs: workoutDurationSeconds(w),
  });

  return (
    <FlatList
      data={recent}
      keyExtractor={(w) => w.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        <Text style={{ color: t.textDim, marginTop: 12 }}>{ready ? 'No workouts logged yet. Start one from the Workouts tab.' : 'Loading…'}</Text>
      }
      ListFooterComponent={hasMore ? <Text style={{ color: t.textDim, textAlign: 'center', marginTop: 8 }}>Loading more…</Text> : undefined}
      renderItem={({ item: w }) => {
        const st = stats(w);
        const top = w.exercises.slice(0, 3);
        return (
          <Pressable
            onPress={() => router.push(`/workout-detail?id=${w.id}` as Href)}
            style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <View style={styles.head}>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {w.title}
              </Text>
              <Text style={{ color: t.textDim, fontSize: 13 }}>{formatDateLabel(w.date, year)}</Text>
            </View>
            <Text style={{ color: t.textDim, fontSize: 13, marginTop: 2 }}>
              {formatDuration(st.secs)} · {formatVolume(st.volume, unit)} · {st.sets} sets
            </Text>
            {top.map((e) => {
              const def = defs.get(e.exerciseId);
              return (
                <View key={e.id} style={styles.exRow}>
                  <ExerciseThumb def={def} size={28} />
                  <Text style={{ color: t.text, fontSize: 14, flex: 1 }} numberOfLines={1}>
                    {e.sets.length} × {def?.title ?? 'Exercise'}
                  </Text>
                </View>
              );
            })}
            {w.exercises.length > top.length && (
              <Text style={{ color: t.textDim, fontSize: 12, marginTop: 4 }}>+{w.exercises.length - top.length} more</Text>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 10, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
});
