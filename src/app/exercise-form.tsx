import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { notifyError } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { allExercises, findByTitle } from '@/domain/exerciseCatalog';
import { newId } from '@/domain/id';
import {
  EQUIPMENT,
  EXERCISE_TYPES,
  EXERCISE_TYPE_LABELS,
  MUSCLES,
  humanize,
  type Equipment,
  type ExerciseDef,
  type ExerciseType,
  type Muscle,
} from '@/domain/workout';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { radius, useTheme } from '@/theme';

/** Create or edit a custom exercise (built-in ones are read-only). */
export default function ExerciseForm() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { customs, addExercise, updateExercise, removeExercise } = useWorkoutLibraryStore();
  const existing = id ? customs.find((e) => e.id === id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [type, setType] = useState<ExerciseType>(existing?.type ?? 'weight_reps');
  const [primary, setPrimary] = useState<Muscle>(existing?.primaryMuscle ?? 'chest');
  const [secondary, setSecondary] = useState<Muscle[]>(existing?.secondaryMuscles ?? []);
  const [equipment, setEquipment] = useState<Equipment>(existing?.equipment ?? 'barbell');
  const [saving, setSaving] = useState(false);

  const clean = title.trim();
  const clash = clean !== '' ? findByTitle(allExercises(customs), clean) : undefined;
  const duplicate = !!clash && clash.id !== existing?.id;
  const canSave = !saving && clean.length > 0 && !duplicate;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const e: ExerciseDef = {
      id: existing?.id ?? newId(),
      title: clean,
      type,
      primaryMuscle: primary,
      secondaryMuscles: secondary.filter((m) => m !== primary),
      equipment,
      isCustom: true,
    };
    try {
      if (existing) await updateExercise(e);
      else await addExercise(e);
      router.back();
    } catch (err) {
      notifyError(err, 'Could not save', 'Could not save this exercise. Please try again.');
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete exercise?', `"${existing?.title}" will be removed from your library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          removeExercise(existing!.id)
            .then(() => router.back())
            .catch((err) => notifyError(err, 'Could not delete')),
      },
    ]);

  const chips = <V extends string>(values: readonly V[], isOn: (v: V) => boolean, onPress: (v: V) => void, label: (v: V) => string = humanize) => (
    <View style={styles.chips}>
      {values.map((v) => (
        <Pressable
          key={v}
          onPress={() => onPress(v)}
          style={[styles.chip, { backgroundColor: isOn(v) ? t.accent : t.surface, borderColor: isOn(v) ? t.accent : t.border }]}
        >
          <Text style={{ color: isOn(v) ? '#fff' : t.text, fontSize: 13, fontWeight: '600' }}>{label(v)}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Screen padBottom>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.head}>
          <Text style={[styles.heading, { color: t.text }]}>{existing ? 'Edit exercise' : 'New exercise'}</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: t.accent, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={[styles.label, { color: t.textDim }]}>Name</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Zercher squat"
            placeholderTextColor={t.textDim}
            maxLength={60}
            autoFocus={!existing}
            style={[styles.input, { backgroundColor: t.surface, borderColor: duplicate ? t.danger : t.border, color: t.text }]}
          />
          {duplicate && <Text style={{ color: t.danger, fontSize: 12, marginTop: 6 }}>An exercise with this name already exists.</Text>}

          <Text style={[styles.label, { color: t.textDim }]}>Tracks</Text>
          {chips(EXERCISE_TYPES, (v) => v === type, setType, (v) => EXERCISE_TYPE_LABELS[v])}

          <Text style={[styles.label, { color: t.textDim }]}>Primary muscle</Text>
          {chips(MUSCLES, (v) => v === primary, setPrimary)}

          <Text style={[styles.label, { color: t.textDim }]}>Also works (optional)</Text>
          {chips(MUSCLES.filter((m) => m !== primary), (v) => secondary.includes(v), (v) => setSecondary((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v])))}

          <Text style={[styles.label, { color: t.textDim }]}>Equipment</Text>
          {chips(EQUIPMENT, (v) => v === equipment, setEquipment)}

          {existing && (
            <Pressable onPress={remove} style={{ marginTop: 28, alignItems: 'center' }}>
              <Text style={{ color: t.danger, fontWeight: '700' }}>Delete exercise</Text>
            </Pressable>
          )}
        </ScrollView>
        <Pressable disabled={!canSave} onPress={save} style={[styles.cta, { backgroundColor: t.accent, opacity: canSave ? 1 : 0.4 }]}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Save</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  heading: { fontSize: 24, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 14, fontSize: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  cta: { alignItems: 'center', paddingVertical: 16, borderRadius: radius.lg, marginTop: 8 },
});
