import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { memo, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DragProps } from '@/components/ReorderableList';
import { ExerciseThumb } from '@/components/workouts/ExerciseThumb';
import { NumField } from '@/components/workouts/NumField';
import { warmupSets, type PlateConfig } from '@/domain/overload';
import { RECORD_LABELS, type RecordKind } from '@/domain/records';
import { lastPerformance, previousSet, workingWeightKg } from '@/domain/session';
import { formatNumber, kgToUnit, parseWeightInput, type WeightUnit } from '@/domain/units';
import {
  REST_PRESETS,
  formatDuration,
  setFields,
  setLabels,
  setWarning,
  type ExerciseDef,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '@/domain/workout';
import { fillFromPrevious, formatSet, hasSetData } from '@/domain/workoutFormat';
import { useWorkoutSession } from '@/store/useWorkoutSession';
import { radius, useTheme } from '@/theme';

const restLabel = (s: number | null) => (!s ? 'Rest: off' : `Rest: ${formatDuration(s)}`);
const nextRest = (s: number | null) => REST_PRESETS[(Math.max(0, REST_PRESETS.indexOf(s ?? 0)) + 1) % REST_PRESETS.length];
const session = () => useWorkoutSession.getState();

/** `setId:kind,kind;setId:kind` ⇄ map. Passed as a string so memoised cards only re-render when their PRs change. */
export const encodePRs = (prs: { setId: string; kind: RecordKind }[]) => prs.map((p) => `${p.setId}:${p.kind}`).join(';');
const decodePRs = (sig: string): Map<string, RecordKind[]> => {
  const m = new Map<string, RecordKind[]>();
  for (const part of sig ? sig.split(';') : []) {
    const [id, kind] = part.split(':');
    m.set(id, [...(m.get(id) ?? []), kind as RecordKind]);
  }
  return m;
};

type Props = {
  exercise: WorkoutExercise;
  def: ExerciseDef | undefined;
  badge: string | null;
  canLinkNext: boolean;
  unit: WeightUnit;
  plates: PlateConfig;
  /** Finished workouts that started before this one and include this exercise. */
  history: Workout[];
  templateId: string | null;
  prSig: string;
  /** Live workout (rest timer + trophies) rather than an edit of a finished one. */
  live: boolean;
  drag: DragProps;
  onReplace: (exId: string) => void;
};

export const WorkoutExerciseCard = memo(function WorkoutExerciseCard({
  exercise: e,
  def,
  badge,
  canLinkNext,
  unit,
  plates,
  history,
  templateId,
  prSig,
  live,
  drag,
  onReplace,
}: Props) {
  const t = useTheme();
  const type = def?.type ?? 'weight_reps';
  const f = setFields(type);
  const assisted = type === 'bodyweight_assisted_reps';
  const labels = setLabels(e.sets);
  const prev = useMemo(() => lastPerformance(history, e.exerciseId, templateId), [history, e.exerciseId, templateId]);
  const prs = useMemo(() => decodePRs(prSig), [prSig]);
  const openInfo = () => def && router.push(`/exercise-info?id=${def.id}` as Href);

  const menu = () =>
    Alert.alert(def?.title ?? 'Exercise', undefined, [
      { text: 'Replace exercise', onPress: () => onReplace(e.id) },
      {
        text: 'Add warm-up sets',
        onPress: () => {
          const base = workingWeightKg(e);
          if (base === null) return Alert.alert('Enter a working weight first', 'Warm-ups are built from your first working set.');
          const ramp = warmupSets(base, plates);
          if (ramp.length === 0) return Alert.alert('No warm-up needed', 'The working weight is at or near the empty bar.');
          session().insertWarmups(e.id, ramp);
        },
      },
      { text: 'History & progress', onPress: openInfo },
      ...(canLinkNext ? [{ text: 'Superset with next exercise', onPress: () => session().linkNext(e.id) }] : []),
      ...(e.supersetId ? [{ text: 'Remove from superset', onPress: () => session().unlink(e.id) }] : []),
      { text: 'Remove exercise', style: 'destructive' as const, onPress: () => session().removeExercise(e.id) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const tick = (s: WorkoutSet, index: number) => {
    if (!s.isCompleted && !hasSetData(s, type)) {
      // Same as last time: borrow the previous numbers for whatever is empty, otherwise there is nothing to log.
      const p = previousSet(prev, index) ?? prev?.sets[prev.sets.length - 1] ?? null;
      const filled = fillFromPrevious(s, p);
      if (!hasSetData(filled, type)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return;
      }
      session().patchSet(e.id, s.id, {
        weightKg: filled.weightKg,
        reps: filled.reps,
        durationSeconds: filled.durationSeconds,
        distanceMeters: filled.distanceMeters,
      });
    }
    session().toggleSet(e.id, s.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const copyPrevious = (s: WorkoutSet, p: WorkoutSet) =>
    session().patchSet(e.id, s.id, { weightKg: p.weightKg, reps: p.reps, durationSeconds: p.durationSeconds, distanceMeters: p.distanceMeters });

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: badge ? t.accent : t.border }]}>
      <Pressable onLongPress={drag.onLongPress} onPressOut={drag.onPressOut} style={styles.head} accessibilityHint="Long-press and drag to reorder">
        <ExerciseThumb def={def} size={44} onPress={openInfo} />
        <Pressable style={{ flex: 1 }} onPress={openInfo}>
          <Text style={[styles.name, { color: t.accent }]} numberOfLines={2}>
            {def?.title ?? 'Unknown exercise'}
          </Text>
          {badge && <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>Superset {badge}</Text>}
        </Pressable>
        <Pressable onPress={menu} hitSlop={12} accessibilityLabel="Exercise options">
          <Ionicons name="ellipsis-horizontal" size={22} color={t.textDim} />
        </Pressable>
      </Pressable>

      <View style={styles.noteRow}>
        <TextInput
          value={e.notes}
          onChangeText={(notes) => session().patchExercise(e.id, { notes })}
          placeholder="Add notes here…"
          placeholderTextColor={t.textDim}
          multiline
          style={[styles.notes, { color: t.text }]}
        />
        <Pressable
          onPress={() => session().patchExercise(e.id, { notesPinned: !e.notesPinned })}
          hitSlop={10}
          accessibilityLabel={e.notesPinned ? 'Unpin notes' : 'Pin notes so they show every time'}
        >
          <Ionicons name={e.notesPinned ? 'pin' : 'pin-outline'} size={18} color={e.notesPinned ? t.accent : t.textDim} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => session().patchExercise(e.id, { restSeconds: nextRest(e.restSeconds) })}
        style={styles.restRow}
        accessibilityLabel={`${restLabel(e.restSeconds)}. Tap to change.`}
      >
        <Ionicons name="timer-outline" size={14} color={t.accent} />
        <Text style={{ color: t.accent, fontSize: 13, fontWeight: '700' }}>{restLabel(e.restSeconds)}</Text>
      </Pressable>

      <View style={styles.row}>
        <Text style={[styles.colHead, styles.setCol, { color: t.textDim }]}>SET</Text>
        <Text style={[styles.colHead, styles.prevCol, { color: t.textDim }]}>PREVIOUS</Text>
        {f.weight && <Text style={[styles.colHead, styles.flex, { color: t.textDim }]}>{assisted ? `-${unit.toUpperCase()}` : type === 'bodyweight_reps' ? `+${unit.toUpperCase()}` : unit.toUpperCase()}</Text>}
        {f.reps && <Text style={[styles.colHead, styles.flex, { color: t.textDim }]}>REPS</Text>}
        {f.duration && <Text style={[styles.colHead, styles.flex, { color: t.textDim }]}>SECONDS</Text>}
        {f.distance && <Text style={[styles.colHead, styles.flex, { color: t.textDim }]}>METERS</Text>}
        <View style={styles.checkCol} />
      </View>

      {e.sets.map((s, i) => {
        const p = previousSet(prev, i);
        const kinds = prs.get(s.id);
        const warn = setWarning(s);
        const done = s.isCompleted;
        const field = { backgroundColor: done ? 'transparent' : t.surfaceAlt };
        return (
          <View key={s.id}>
            <View style={[styles.row, styles.setRow, done && { backgroundColor: t.successSoft }]}>
              <Pressable
                onPress={() => session().cycleSetType(e.id, s.id)}
                onLongPress={() => Alert.alert('Set type', 'Tap the number to switch between normal, warm-up (W), drop set (D) and failure (F).')}
                style={styles.setCol}
                accessibilityLabel={`Set ${labels[i]}, ${s.setType}. Tap to change type.`}
              >
                <Text style={{ color: s.setType === 'normal' ? t.text : t.accent, fontWeight: '800', textAlign: 'center', fontSize: 16 }}>{labels[i]}</Text>
              </Pressable>
              <Pressable
                disabled={!p}
                onPress={() => p && copyPrevious(s, p)}
                style={styles.prevCol}
                accessibilityLabel={p ? `Previous ${formatSet(p, type, unit)}. Tap to copy.` : 'No previous set'}
              >
                <Text style={{ color: t.textDim, fontSize: 12, textAlign: 'center' }} numberOfLines={1}>
                  {p ? formatSet(p, type, unit) : '–'}
                </Text>
              </Pressable>
              {f.weight && (
                <NumField
                  style={field}
                  value={s.weightKg === null ? null : assisted ? Math.abs(s.weightKg) : s.weightKg}
                  format={(kg) => formatNumber(kgToUnit(kg, unit))}
                  parse={(txt) => parseWeightInput(txt, unit)}
                  onChange={(kg) => session().patchSet(e.id, s.id, { weightKg: kg === null ? null : assisted ? -Math.abs(kg) : kg })}
                  accessibilityLabel={`Weight, set ${labels[i]}`}
                />
              )}
              {f.reps && <NumField integer style={field} value={s.reps} onChange={(v) => session().patchSet(e.id, s.id, { reps: v })} accessibilityLabel={`Reps, set ${labels[i]}`} />}
              {f.duration && <NumField integer style={field} value={s.durationSeconds} onChange={(v) => session().patchSet(e.id, s.id, { durationSeconds: v })} />}
              {f.distance && <NumField style={field} value={s.distanceMeters} onChange={(v) => session().patchSet(e.id, s.id, { distanceMeters: v })} />}
              <Pressable
                onPress={() => tick(s, i)}
                onLongPress={() => Alert.alert('Remove set?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => session().removeSet(e.id, s.id) }])}
                style={[styles.checkCol, styles.check, { backgroundColor: done ? t.success : t.surfaceAlt }]}
                accessibilityLabel={done ? `Set ${labels[i]} done. Tap to undo. Long-press to remove.` : `Mark set ${labels[i]} done. Long-press to remove.`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
              >
                <Ionicons name="checkmark" size={20} color={done ? '#fff' : t.textDim} />
              </Pressable>
            </View>
            {live && kinds && done && (
              <View style={styles.prRow}>
                <Ionicons name="trophy" size={13} color="#F5B800" />
                <Text style={{ color: '#F5B800', fontSize: 12, fontWeight: '700' }}>{kinds.map((k) => RECORD_LABELS[k]).join(' · ')}</Text>
              </View>
            )}
            {warn && !done && <Text style={{ color: t.danger, fontSize: 12, marginLeft: 6 }}>{warn}</Text>}
          </View>
        );
      })}

      <Pressable onPress={() => session().addSet(e.id)} style={[styles.addSet, { backgroundColor: t.surfaceAlt }]}>
        <Ionicons name="add" size={16} color={t.text} />
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 13 }}>Add set</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 12, marginBottom: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 17, fontWeight: '700' },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notes: { flex: 1, fontSize: 14, paddingVertical: 4 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setRow: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 2 },
  colHead: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  setCol: { width: 34 },
  prevCol: { flex: 1.4, minWidth: 0 },
  flex: { flex: 1 },
  checkCol: { width: 38 },
  check: { height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 6, marginTop: 2, marginBottom: 2 },
  addSet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 10, marginTop: 4 },
});
