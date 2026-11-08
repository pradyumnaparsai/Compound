import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DragProps } from '@/components/ReorderableList';
import { NumField } from '@/components/workouts/NumField';
import { formatNumber, kgToUnit, parseWeightInput, type WeightUnit } from '@/domain/units';
import {
  SET_TYPE_HINTS,
  formatDuration,
  setFields,
  setLabels,
  type ExerciseDef,
  type TemplateExercise,
  type TemplateSet,
} from '@/domain/workout';
import { useTemplateDraft } from '@/store/useTemplateDraft';
import { radius, useTheme } from '@/theme';

export const REST_PRESETS = [0, 30, 45, 60, 90, 120, 180, 240, 300];
const restLabel = (s: number | null) => (!s ? 'Rest: off' : `Rest: ${formatDuration(s)}`);
const nextRest = (s: number | null) => REST_PRESETS[(Math.max(0, REST_PRESETS.indexOf(s ?? 0)) + 1) % REST_PRESETS.length];

type Props = {
  exercise: TemplateExercise;
  def: ExerciseDef | undefined;
  /** Letter badge when the exercise is part of a superset, null otherwise. */
  badge: string | null;
  canLinkNext: boolean;
  unit: WeightUnit;
  drag: DragProps;
};

/** One exercise of a template: header (drag handle + menu), rest timer, notes and a table of target sets. */
export const TemplateExerciseCard = memo(function TemplateExerciseCard({ exercise: e, def, badge, canLinkNext, unit, drag }: Props) {
  const t = useTheme();
  const d = useTemplateDraft.getState;
  const type = def?.type ?? 'weight_reps';
  const f = setFields(type);
  const assisted = type === 'bodyweight_assisted_reps';
  const labels = setLabels(e.sets);

  const menu = () =>
    Alert.alert(def?.title ?? 'Exercise', undefined, [
      ...(canLinkNext ? [{ text: 'Superset with next exercise', onPress: () => d().linkNext(e.id) }] : []),
      ...(e.supersetId ? [{ text: 'Remove from superset', onPress: () => d().unlink(e.id) }] : []),
      { text: 'Remove exercise', style: 'destructive' as const, onPress: () => d().removeExercise(e.id) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const weightProps = (s: TemplateSet) => ({
    value: s.weightKg === null ? null : assisted ? Math.abs(s.weightKg) : s.weightKg,
    format: (kg: number) => formatNumber(kgToUnit(kg, unit)),
    parse: (txt: string) => parseWeightInput(txt, unit),
    onChange: (kg: number | null) => d().patchSet(e.id, s.id, { weightKg: kg === null ? null : assisted ? -Math.abs(kg) : kg }),
  });

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: badge ? t.accent : t.border }]}>
      <Pressable onLongPress={drag.onLongPress} onPressOut={drag.onPressOut} style={styles.head} accessibilityHint="Long-press and drag to reorder">
        <Ionicons name="reorder-three" size={22} color={t.textDim} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
            {def?.title ?? 'Unknown exercise'}
          </Text>
          {badge && <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>Superset {badge}</Text>}
        </View>
        <Pressable onPress={menu} hitSlop={12} accessibilityLabel="Exercise options">
          <Ionicons name="ellipsis-horizontal" size={22} color={t.textDim} />
        </Pressable>
      </Pressable>

      <View style={styles.metaRow}>
        <Pressable
          onPress={() => d().patchExercise(e.id, { restSeconds: nextRest(e.restSeconds) })}
          style={[styles.pill, { backgroundColor: t.accentSoft }]}
          accessibilityLabel={`${restLabel(e.restSeconds)}. Tap to change.`}
        >
          <Ionicons name="timer-outline" size={14} color={t.accent} />
          <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>{restLabel(e.restSeconds)}</Text>
        </Pressable>
      </View>

      <View style={styles.notesRow}>
        <TextInput
          value={e.notes}
          onChangeText={(notes) => d().patchExercise(e.id, { notes })}
          placeholder="Notes"
          placeholderTextColor={t.textDim}
          multiline
          style={[styles.notes, { backgroundColor: t.surfaceAlt, color: t.text }]}
        />
        <Pressable
          onPress={() => d().patchExercise(e.id, { notesPinned: !e.notesPinned })}
          hitSlop={10}
          accessibilityLabel={e.notesPinned ? 'Unpin notes' : 'Pin notes so they show every time'}
        >
          <Ionicons name={e.notesPinned ? 'pin' : 'pin-outline'} size={20} color={e.notesPinned ? t.accent : t.textDim} />
        </Pressable>
      </View>

      <View style={styles.setRow}>
        <Text style={[styles.colHead, styles.setCol, { color: t.textDim }]}>SET</Text>
        {f.weight && <Text style={[styles.colHead, styles.flex, { color: t.textDim }]}>{assisted ? `ASSIST ${unit.toUpperCase()}` : type === 'bodyweight_reps' ? `+${unit.toUpperCase()}` : unit.toUpperCase()}</Text>}
        {f.reps && <Text style={[styles.colHead, styles.flex2, { color: t.textDim }]}>REPS</Text>}
        {f.duration && <Text style={[styles.colHead, styles.flex, { color: t.textDim }]}>SECONDS</Text>}
        {f.distance && <Text style={[styles.colHead, styles.flex, { color: t.textDim }]}>METERS</Text>}
        <View style={styles.delCol} />
      </View>

      {e.sets.map((s, i) => (
        <View key={s.id} style={styles.setRow}>
          <Pressable
            onPress={() => d().cycleSetType(e.id, s.id)}
            onLongPress={() => Alert.alert(`Set type: ${s.setType}`, SET_TYPE_HINTS[s.setType])}
            style={[styles.setCol, styles.typeBtn, { backgroundColor: s.setType === 'normal' ? t.surfaceAlt : t.accentSoft }]}
            accessibilityLabel={`Set ${labels[i]}, ${s.setType}. Tap to change type.`}
          >
            <Text style={{ color: s.setType === 'normal' ? t.text : t.accent, fontWeight: '800' }}>{labels[i]}</Text>
          </Pressable>
          {f.weight && <NumField {...weightProps(s)} />}
          {f.reps && (
            <View style={[styles.flex2, styles.range]}>
              <NumField integer value={s.repMin} onChange={(v) => d().patchSet(e.id, s.id, { repMin: v })} placeholder="min" />
              <Text style={{ color: t.textDim }}>–</Text>
              <NumField integer value={s.repMax} onChange={(v) => d().patchSet(e.id, s.id, { repMax: v })} placeholder="max" />
            </View>
          )}
          {f.duration && <NumField integer value={s.durationSeconds} onChange={(v) => d().patchSet(e.id, s.id, { durationSeconds: v })} />}
          {f.distance && <NumField value={s.distanceMeters} onChange={(v) => d().patchSet(e.id, s.id, { distanceMeters: v })} />}
          <Pressable
            onPress={() => d().removeSet(e.id, s.id)}
            disabled={e.sets.length <= 1}
            hitSlop={8}
            style={[styles.delCol, { opacity: e.sets.length <= 1 ? 0.25 : 1 }]}
            accessibilityLabel={`Remove set ${labels[i]}`}
          >
            <Ionicons name="close" size={18} color={t.textDim} />
          </Pressable>
        </View>
      ))}

      <Pressable onPress={() => d().addSet(e.id)} style={[styles.addSet, { backgroundColor: t.surfaceAlt }]}>
        <Ionicons name="add" size={16} color={t.text} />
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 13 }}>Add set</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 12, marginBottom: 12, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 17, fontWeight: '700' },
  metaRow: { flexDirection: 'row' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  notes: { flex: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, minHeight: 36 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  colHead: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  setCol: { width: 38 },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  range: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  delCol: { width: 26, alignItems: 'center' },
  typeBtn: { alignItems: 'center', justifyContent: 'center', height: 34, borderRadius: 10 },
  addSet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 10 },
});
