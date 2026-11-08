import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip, ChipRow } from '@/components/Chip';
import { onFail } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { ExerciseThumb } from '@/components/workouts/ExerciseThumb';
import { allExercises, searchExercises } from '@/domain/exerciseCatalog';
import { EQUIPMENT, MUSCLES, humanize, type Equipment, type ExerciseDef, type Muscle } from '@/domain/workout';
import { useTemplateDraft } from '@/store/useTemplateDraft';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { useWorkoutSession } from '@/store/useWorkoutSession';
import { radius, useTheme } from '@/theme';

/** Exercise catalog: search + muscle/equipment filters. With `?pick=1` it returns the chosen exercises to the template builder. */
export default function ExercisesScreen() {
  const t = useTheme();
  const { pick, target, exId } = useLocalSearchParams<{ pick?: string; target?: string; exId?: string }>();
  const picking = pick === '1';
  const single = target === 'replace'; // swap one exercise for another
  const customs = useWorkoutLibraryStore((s) => s.customs);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);

  const list = useMemo(() => searchExercises(allExercises(customs), { query, muscle, equipment }), [customs, query, muscle, equipment]);

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : single ? [id] : [...c, id]));
  const onRow = (e: ExerciseDef) => {
    if (picking) toggle(e.id);
    else openInfo(e.id);
  };
  const openInfo = (id: string) => router.push(`/exercise-info?id=${id}` as Href);
  const confirm = () => {
    if (target === 'workout') useWorkoutSession.getState().addExercises(chosen).catch(onFail());
    else if (target === 'replace' && exId) useWorkoutSession.getState().replaceExercise(exId, chosen[0]).catch(onFail());
    else useTemplateDraft.getState().addExercises(chosen);
    router.back();
  };

  const chips = <V extends string>(values: readonly V[], current: V | null, set: (v: V | null) => void) => (
    <ChipRow>
      {values.map((v) => (
        <Chip key={v} label={humanize(v)} on={current === v} onPress={() => set(current === v ? null : v)} />
      ))}
    </ChipRow>
  );

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.title, { color: t.text }]}>{picking ? (single ? 'Replace exercise' : 'Add exercises') : 'Exercises'}</Text>
        <Pressable onPress={() => router.push('/exercise-form' as Href)} hitSlop={12} accessibilityLabel="New custom exercise">
          <Ionicons name="add-circle" size={30} color={t.accent} />
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search exercises"
        placeholderTextColor={t.textDim}
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={[styles.search, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
      />
      {chips(MUSCLES, muscle, setMuscle)}
      {chips(EQUIPMENT, equipment, setEquipment)}

      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: picking && chosen.length > 0 ? 90 : 24 }}
        ListEmptyComponent={
          <Text style={{ color: t.textDim, marginTop: 12 }}>
            No match. Tap + to create “{query.trim() || 'a custom exercise'}”.
          </Text>
        }
        renderItem={({ item }) => {
          const on = chosen.includes(item.id);
          return (
            <Pressable
              onPress={() => onRow(item)}
              style={[styles.row, { backgroundColor: on ? t.accentSoft : t.surface, borderColor: on ? t.accent : t.border }]}
            >
              <ExerciseThumb def={item} size={46} onPress={() => openInfo(item.id)} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
                <Text style={{ color: t.textDim, fontSize: 12, marginTop: 2 }}>
                  {humanize(item.primaryMuscle)} · {humanize(item.equipment)}
                  {item.isCustom ? ' · Custom' : ''}
                </Text>
              </View>
              {picking ? (
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? t.accent : t.textDim} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={t.textDim} />
              )}
            </Pressable>
          );
        }}
      />

      {picking && chosen.length > 0 && (
        <Pressable onPress={confirm} style={[styles.cta, { backgroundColor: t.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
            {single ? 'Replace' : `Add ${chosen.length} exercise${chosen.length === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  search: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, marginBottom: 8 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center', paddingVertical: 16, borderRadius: radius.lg },
});
