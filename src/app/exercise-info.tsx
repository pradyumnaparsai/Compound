import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { PoseFigure } from '@/components/workouts/PoseFigure';
import { ProgressChart } from '@/components/workouts/ProgressChart';
import { sqliteWorkoutRepo } from '@/data/sqliteWorkoutLogRepository';
import { exerciseMap } from '@/domain/exerciseCatalog';
import { patternFor } from '@/domain/poses';
import { exerciseProgress, RECORD_LABELS, type RecordKind } from '@/domain/records';
import { formatNumber, kgToUnit } from '@/domain/units';
import { EXERCISE_TYPE_LABELS, humanize, setLabels, type Workout } from '@/domain/workout';
import { formatDateLabel, formatSet, formatVolume } from '@/domain/workoutFormat';
import { useUnitStore } from '@/store/useUnitStore';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { radius, useTheme } from '@/theme';

/** Exercise details: a looping animation of the movement, muscles and equipment, then progress and history. */
export default function ExerciseInfo() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customs = useWorkoutLibraryStore((s) => s.customs);
  const def = useMemo(() => exerciseMap(customs).get(id), [customs, id]);
  const pattern = def ? patternFor(def.id, def.primaryMuscle) : null;
  const unit = useUnitStore((s) => s.unit);
  const [history, setHistory] = useState<Workout[]>([]);
  const [metric, setMetric] = useState<'weight' | 'oneRM' | 'volume'>('weight');

  useEffect(() => {
    let alive = true;
    sqliteWorkoutRepo
      .listForExercises([id])
      .then((h) => alive && setHistory(h))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  const type = def?.type ?? 'weight_reps';
  const hasWeight = type === 'weight_reps' || type === 'bodyweight_reps' || type === 'bodyweight_assisted_reps' || type === 'weight_duration';
  const points = useMemo(() => exerciseProgress(history, id, type).slice(-20), [history, id, type]);
  const chart = useMemo(
    () =>
      points.map((p) => {
        const kg = metric === 'weight' ? p.bestWeightKg : metric === 'oneRM' ? p.best1RM : p.volume;
        return {
          key: p.date,
          label: formatDateLabel(p.date).slice(5),
          value: kg,
          valueLabel: metric === 'volume' ? formatVolume(kg, unit).replace(` ${unit}`, '') : formatNumber(kgToUnit(kg, unit)),
        };
      }),
    [points, metric, unit],
  );
  const best = useMemo(() => {
    const sets = history.flatMap((w) => w.exercises.flatMap((e) => e.sets.filter((s) => s.isCompleted && s.setType !== 'warmup')));
    const top = (f: (s: (typeof sets)[number]) => number) => sets.reduce((m, s) => Math.max(m, f(s)), 0);
    const rec: { kind: RecordKind; value: string }[] = [];
    const wMax = top((s) => s.weightKg ?? 0);
    const orm = top((s) => ((s.weightKg ?? 0) > 0 && (s.reps ?? 0) > 0 ? (s.weightKg as number) * (1 + (s.reps as number) / 30) : 0));
    const vol = top((s) => Math.max(0, s.weightKg ?? 0) * (s.reps ?? 0));
    const reps = top((s) => s.reps ?? 0);
    if (wMax > 0) rec.push({ kind: 'weight', value: `${formatNumber(kgToUnit(wMax, unit))} ${unit}` });
    if (orm > 0) rec.push({ kind: 'oneRM', value: `${formatNumber(kgToUnit(orm, unit))} ${unit}` });
    if (vol > 0) rec.push({ kind: 'setVolume', value: formatVolume(vol, unit) });
    if (reps > 0) rec.push({ kind: 'reps', value: `${reps}` });
    return rec;
  }, [history, unit]);

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
          {def?.title ?? 'Exercise'}
        </Text>
        {def?.isCustom ? (
          <Pressable onPress={() => router.push(`/exercise-form?id=${def.id}` as Href)} hitSlop={12}>
            <Text style={{ color: t.accent, fontWeight: '700' }}>Edit</Text>
          </Pressable>
        ) : (
          <View style={{ width: 26 }} />
        )}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {pattern && (
          <View style={[styles.frameWrap, { backgroundColor: t.accentSoft }]}>
            <PoseFigure pattern={pattern} size={220} body={t.accent} dim={t.textDim} accessibilityLabel={`${def?.title} movement`} />
          </View>
        )}
        {def && (
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Row label="Primary muscle" value={humanize(def.primaryMuscle)} />
            {def.secondaryMuscles.length > 0 && <Row label="Also works" value={def.secondaryMuscles.map(humanize).join(', ')} />}
            <Row label="Equipment" value={humanize(def.equipment)} />
            <Row label="Tracks" value={EXERCISE_TYPE_LABELS[def.type]} />
          </View>
        )}
        {history.length > 0 && (
          <>
            {hasWeight && (
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, marginTop: 16 }]}>
                <Text style={[styles.h2, { color: t.text }]}>Progress</Text>
                <Segmented
                  options={[
                    { value: 'weight', label: 'Best set' },
                    { value: 'oneRM', label: 'Est. 1RM' },
                    { value: 'volume', label: 'Volume' },
                  ]}
                  value={metric}
                  onChange={setMetric}
                />
                <ProgressChart data={chart} />
                <Text style={{ color: t.textDim, fontSize: 11 }}>
                  {metric === 'weight' ? `Heaviest set per workout (${unit})` : metric === 'oneRM' ? `Epley estimate: weight × (1 + reps / 30) (${unit})` : `Total volume per workout (${unit})`}
                  {' · warm-ups excluded'}
                </Text>
              </View>
            )}
            {best.length > 0 && (
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, marginTop: 16 }]}>
                <Text style={[styles.h2, { color: t.text }]}>Records</Text>
                {best.map((r) => (
                  <Row key={r.kind} label={RECORD_LABELS[r.kind]} value={r.value} />
                ))}
              </View>
            )}
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, marginTop: 16 }]}>
              <Text style={[styles.h2, { color: t.text }]}>History</Text>
              {history.slice(0, 10).map((w) => {
                const sets = w.exercises.flatMap((e) => e.sets);
                const labels = setLabels(sets);
                return (
                  <Pressable key={w.id} onPress={() => router.push(`/workout-detail?id=${w.id}` as Href)} style={{ gap: 2 }}>
                    <Text style={{ color: t.accent, fontWeight: '700' }}>{formatDateLabel(w.date)}</Text>
                    <Text style={{ color: t.textDim, fontSize: 13 }}>
                      {sets
                        .map((s, i) => `${s.setType === 'normal' ? '' : `${labels[i]} `}${formatSet(s, type, unit)}`)
                        .join('  ·  ')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        {history.length === 0 && def && (
          <Text style={{ color: t.textDim, marginTop: 16, textAlign: 'center' }}>No logged sets yet. Progress shows up here after your first workout with this exercise.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: t.textDim, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  frameWrap: { alignSelf: 'center', width: 240, height: 240, alignItems: 'center', justifyContent: 'center', borderRadius: 120, marginBottom: 16 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 12 },
  h2: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
});
