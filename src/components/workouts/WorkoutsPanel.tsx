import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { onFail } from '@/components/notify';
import { ReorderableList } from '@/components/ReorderableList';
import { Segmented } from '@/components/Segmented';
import { ActiveWorkoutBanner } from '@/components/workouts/ActiveWorkoutBanner';
import { HistoryPanel } from '@/components/workouts/HistoryPanel';
import { startWorkout } from '@/hooks/useStartWorkout';
import { exerciseMap } from '@/domain/exerciseCatalog';
import type { WorkoutTemplate } from '@/domain/workout';
import { useWorkoutFocus } from '@/store/useWorkoutFocus';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { radius, useTheme } from '@/theme';

const setCount = (t: WorkoutTemplate) => t.exercises.reduce((n, e) => n + e.sets.length, 0);

type Sub = 'templates' | 'history';

/** Workouts: the in-progress banner, then Templates (start a session) or History (what was logged). */
export function WorkoutsPanel() {
  const t = useTheme();
  const highlightId = useWorkoutFocus((s) => s.highlightId);
  // After finishing a workout show what was logged, not the templates, until the user picks a tab.
  const [manual, setManual] = useState<{ value: Sub; at: string | null }>({ value: 'templates', at: null });
  const sub = highlightId && manual.at !== highlightId ? 'history' : manual.value;
  const setSub = (value: Sub) => setManual({ value, at: highlightId });
  return (
    <View style={{ flex: 1 }}>
      <ActiveWorkoutBanner />
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Segmented
            options={[
              { value: 'templates', label: 'Templates' },
              { value: 'history', label: 'History' },
            ]}
            value={sub}
            onChange={setSub}
          />
        </View>
        <Pressable
          onPress={() => router.push('/workout-manage' as Href)}
          style={[styles.manage, { backgroundColor: t.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel="Manage templates, exercises and settings"
        >
          <Ionicons name="options-outline" size={22} color={t.text} />
        </Pressable>
      </View>
      {sub === 'templates' ? <TemplatesList /> : <HistoryPanel />}
    </View>
  );
}

/** Templates (planned sessions): start one with a tap, drag to reorder. Creating/managing lives on the Manage screen. */
function TemplatesList() {
  const t = useTheme();
  const { templates, customs, reorderTemplates, duplicate, removeTemplate } = useWorkoutLibraryStore();
  const names = useMemo(() => exerciseMap(customs), [customs]);

  const openTemplate = (id?: string) => router.push((id ? `/template?id=${id}` : '/template') as Href);

  const templateMenu = (x: WorkoutTemplate) =>
    Alert.alert(x.title || 'Template', undefined, [
      { text: 'Edit template', onPress: () => openTemplate(x.id) },
      { text: 'Duplicate', onPress: () => duplicate(x.id).catch(onFail()) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete template?', `"${x.title}" will be removed. Logged workouts are kept.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => removeTemplate(x.id).catch(onFail()) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <ReorderableList
      data={templates}
      contentContainerStyle={{ paddingBottom: 32 }}
      onReorder={(ids) => reorderTemplates(ids).catch(onFail())}
      empty={
        <View style={{ marginTop: 12, gap: 12, alignItems: 'flex-start' }}>
          <Text style={{ color: t.textDim }}>No templates yet. Create one to start repeating a session.</Text>
          <Pressable onPress={() => openTemplate()} style={[styles.primary, { backgroundColor: t.accent }]}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700' }}>New template</Text>
          </Pressable>
        </View>
      }
      renderItem={(x, drag) => {
        const exNames = x.exercises.map((e) => names.get(e.exerciseId)?.title ?? 'Unknown exercise');
        return (
          <Pressable
            onPress={() => openTemplate(x.id)}
            onLongPress={drag.onLongPress}
            onPressOut={drag.onPressOut}
            style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: t.text }]} numberOfLines={1}>
                {x.title || 'Untitled'}
              </Text>
              <Text style={{ color: t.textDim, fontSize: 13, marginTop: 2 }}>
                {x.exercises.length} exercise{x.exercises.length === 1 ? '' : 's'} · {setCount(x)} set{setCount(x) === 1 ? '' : 's'}
              </Text>
              {exNames.length > 0 && (
                <Text style={{ color: t.textDim, fontSize: 12, marginTop: 6 }} numberOfLines={2}>
                  {exNames.join(' · ')}
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Pressable onPress={() => startWorkout(x)} style={[styles.start, { backgroundColor: t.accent }]} accessibilityRole="button" accessibilityLabel={`Start ${x.title}`}>
                <Ionicons name="play" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Start</Text>
              </Pressable>
              <Pressable onPress={() => templateMenu(x)} hitSlop={12} accessibilityLabel={`More actions for ${x.title}`}>
                <Ionicons name="ellipsis-horizontal" size={20} color={t.textDim} />
              </Pressable>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  start: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  manage: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
});
