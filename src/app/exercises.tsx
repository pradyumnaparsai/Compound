import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { allExercises, searchExercises } from '@/domain/exerciseCatalog';
import { EQUIPMENT, MUSCLES, humanize, type Equipment, type ExerciseDef, type Muscle } from '@/domain/workout';
import { useTemplateDraft } from '@/store/useTemplateDraft';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { radius, useTheme } from '@/theme';

/** Exercise catalog: search + muscle/equipment filters. With `?pick=1` it returns the chosen exercises to the template builder. */
export default function ExercisesScreen() {
  const t = useTheme();
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const picking = pick === '1';
  const customs = useWorkoutLibraryStore((s) => s.customs);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);

  const list = useMemo(() => searchExercises(allExercises(customs), { query, muscle, equipment }), [customs, query, muscle, equipment]);

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const onRow = (e: ExerciseDef) => {
    if (picking) toggle(e.id);
    else if (e.isCustom) router.push(`/exercise-form?id=${e.id}` as Href);
  };
  const confirm = () => {
    useTemplateDraft.getState().addExercises(chosen);
    router.back();
  };

  const chips = <V extends string>(values: readonly V[], current: V | null, set: (v: V | null) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {values.map((v) => {
        const on = current === v;
        return (
          <Pressable
            key={v}
            onPress={() => set(on ? null : v)}
            style={[styles.chip, { backgroundColor: on ? t.accent : t.surface, borderColor: on ? t.accent : t.border }]}
          >
            <Text style={{ color: on ? '#fff' : t.text, fontSize: 12, fontWeight: '600' }}>{humanize(v)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.title, { color: t.text }]}>{picking ? 'Add exercises' : 'Exercises'}</Text>
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
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
                <Text style={{ color: t.textDim, fontSize: 12, marginTop: 2 }}>
                  {humanize(item.primaryMuscle)} · {humanize(item.equipment)}
                  {item.isCustom ? ' · Custom' : ''}
                </Text>
              </View>
              {picking ? (
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? t.accent : t.textDim} />
              ) : item.isCustom ? (
                <Ionicons name="chevron-forward" size={18} color={t.textDim} />
              ) : null}
            </Pressable>
          );
        }}
      />

      {picking && chosen.length > 0 && (
        <Pressable onPress={confirm} style={[styles.cta, { backgroundColor: t.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
            Add {chosen.length} exercise{chosen.length === 1 ? '' : 's'}
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
  chips: { gap: 8, paddingBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.md, borderWidth: 1, marginBottom: 8 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center', paddingVertical: 16, borderRadius: radius.lg },
});
