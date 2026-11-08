import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ExerciseThumb } from '@/components/workouts/ExerciseThumb';
import { exerciseMap } from '@/domain/exerciseCatalog';
import { RECORD_LABELS } from '@/domain/records';
import type { WorkoutSummary } from '@/domain/summary';
import type { WeightUnit } from '@/domain/units';
import { formatDuration, setLabels, type Workout } from '@/domain/workout';
import { formatDateLabel, formatPR, formatSet, formatVolume } from '@/domain/workoutFormat';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { radius, useTheme } from '@/theme';

/** Read-only view of a finished workout: totals, PRs and every exercise with its sets. */
export function WorkoutOverview({ workout, summary, unit }: { workout: Workout; summary: WorkoutSummary; unit: WeightUnit }) {
  const t = useTheme();
  const customs = useWorkoutLibraryStore((s) => s.customs);
  const defs = useMemo(() => exerciseMap(customs), [customs]);
  const prSets = useMemo(() => new Set(summary.prs.map((p) => p.setId)), [summary.prs]);

  return (
    <View style={{ gap: 14 }}>
      <View>
        <Text style={[styles.title, { color: t.text }]}>{workout.title}</Text>
        <Text style={{ color: t.textDim, marginTop: 2 }}>{formatDateLabel(workout.date, new Date().getFullYear())}</Text>
        {workout.notes ? <Text style={{ color: t.text, marginTop: 8 }}>{workout.notes}</Text> : null}
      </View>

      <View style={[styles.stats, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Stat label="Duration" value={formatDuration(summary.durationSeconds)} />
        <Stat label="Volume" value={formatVolume(summary.volumeKg, unit)} />
        <Stat label="Sets" value={String(summary.setCount)} />
        <Stat label="PRs" value={String(summary.prs.length)} accent={summary.prs.length > 0} />
      </View>

      {summary.prs.length > 0 && (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.h2, { color: t.text }]}>Personal records</Text>
          {summary.prs.map((p) => (
            <View key={`${p.setId}:${p.kind}`} style={styles.prRow}>
              <Ionicons name="trophy" size={16} color="#F5B800" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '600' }}>{defs.get(p.exerciseId)?.title ?? 'Exercise'}</Text>
                <Text style={{ color: t.textDim, fontSize: 13 }}>
                  {RECORD_LABELS[p.kind]}: {formatPR(p, workout, unit)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {workout.exercises.map((e) => {
        const def = defs.get(e.exerciseId);
        const labels = setLabels(e.sets);
        return (
          <View key={e.id} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.exHead}>
              <ExerciseThumb def={def} size={40} onPress={def ? () => router.push(`/exercise-info?id=${def.id}` as Href) : undefined} />
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{def?.title ?? 'Unknown exercise'}</Text>
            </View>
            {e.notes ? <Text style={{ color: t.textDim, fontSize: 13 }}>{e.notes}</Text> : null}
            {e.sets.map((s, i) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={{ color: s.setType === 'normal' ? t.textDim : t.accent, width: 28, fontWeight: '700' }}>{labels[i]}</Text>
                <Text style={{ color: t.text, flex: 1, fontSize: 15 }}>{formatSet(s, def?.type ?? 'weight_reps', unit)}</Text>
                {prSets.has(s.id) && <Ionicons name="trophy" size={14} color="#F5B800" />}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: t.textDim, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: accent ? '#F5B800' : t.text, fontSize: 17, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 8 },
  h2: { fontSize: 17, fontWeight: '700' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
