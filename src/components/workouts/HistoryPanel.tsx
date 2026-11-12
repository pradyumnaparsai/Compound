import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ExerciseThumb } from '@/components/workouts/ExerciseThumb';
import { exerciseMap } from '@/domain/exerciseCatalog';
import { weightOn } from '@/domain/weight';
import { workoutDurationSeconds, formatDuration, workoutVolume, completedSetCount, type Workout } from '@/domain/workout';
import { formatDateLabel, formatVolume } from '@/domain/workoutFormat';
import { useUnitStore } from '@/store/useUnitStore';
import { useWeightStore } from '@/store/useWeightStore';
import { useWorkoutFocus } from '@/store/useWorkoutFocus';
import { useWorkoutHistory } from '@/store/useWorkoutHistory';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { radius, useTheme } from '@/theme';

type Defs = ReturnType<typeof exerciseMap>;
type Weights = ReturnType<typeof useWeightStore.getState>['entries'];
type Unit = ReturnType<typeof useUnitStore.getState>['unit'];

/** One history card. Memoised: scrolling and "load more" must not re-render (or recompute stats for) rows already shown. */
const HistoryRow = memo(function HistoryRow({
  w,
  defs,
  weights,
  unit,
  warmupVolume,
  year,
  fresh,
}: {
  w: Workout;
  defs: Defs;
  weights: Weights;
  unit: Unit;
  warmupVolume: boolean;
  year: number;
  fresh: boolean;
}) {
  const t = useTheme();
  const st = useMemo(
    () => ({
      volume: workoutVolume(w, (id) => defs.get(id)?.type, { includeWarmup: warmupVolume, bodyweightKg: weightOn(weights, w.date) }),
      sets: completedSetCount(w, true),
      secs: workoutDurationSeconds(w),
    }),
    [w, defs, weights, warmupVolume],
  );
  const top = w.exercises.slice(0, 3);
  return (
    <Pressable
      onPress={() => router.push(`/workout-detail?id=${w.id}` as Href)}
      style={[
        styles.card,
        { backgroundColor: fresh ? t.accentSoft : t.surface, borderColor: fresh ? t.accent : t.border },
        fresh && { borderWidth: 2 },
      ]}
    >
      {fresh && (
        <View style={styles.badge}>
          <Ionicons name="checkmark-circle" size={16} color={t.accent} />
          <Text style={{ color: t.accent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Just logged</Text>
        </View>
      )}
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
            {/* frozen figure: dozens of looping animated thumbs make the list stutter while scrolling */}
            <ExerciseThumb def={def} size={28} animated={false} />
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
});

/** Logged workouts, newest first. Tap one for details, PRs, edit and delete. */
export function HistoryPanel() {
  const t = useTheme();
  const { recent, hasMore, loadMore, ready } = useWorkoutHistory();
  const customs = useWorkoutLibraryStore((s) => s.customs);
  const weights = useWeightStore((s) => s.entries);
  const unit = useUnitStore((s) => s.unit);
  const warmupVolume = useUnitStore((s) => s.warmupVolume);
  const defs = useMemo(() => exerciseMap(customs), [customs]);
  const year = new Date().getFullYear();
  const highlightId = useWorkoutFocus((s) => s.highlightId);
  const listRef = useRef<FlatList<Workout>>(null);
  // Just finished a workout: it is the newest, so start the list at the top. Only when the highlight changes:
  // the highlight stays set while browsing, and re-running on every loaded page would yank the list back up.
  useEffect(() => {
    if (highlightId) listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [highlightId]);

  const renderItem = useCallback(
    ({ item }: { item: Workout }) => (
      <HistoryRow w={item} defs={defs} weights={weights} unit={unit} warmupVolume={warmupVolume} year={year} fresh={item.id === highlightId} />
    ),
    [defs, weights, unit, warmupVolume, year, highlightId],
  );
  const onEndReached = useCallback(() => void loadMore(), [loadMore]);

  return (
    <FlatList
      ref={listRef}
      data={recent}
      keyExtractor={keyOf}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      windowSize={7}
      removeClippedSubviews
      ListEmptyComponent={
        <Text style={{ color: t.textDim, marginTop: 12 }}>{ready ? 'No workouts logged yet. Start one from the Workouts tab.' : 'Loading…'}</Text>
      }
      ListFooterComponent={hasMore ? <Text style={{ color: t.textDim, textAlign: 'center', marginTop: 8 }}>Loading more…</Text> : undefined}
      renderItem={renderItem}
    />
  );
}

const keyOf = (w: Workout) => w.id;

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 10, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
});
