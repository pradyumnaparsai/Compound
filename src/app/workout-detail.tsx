import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notifyError } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { WorkoutOverview } from '@/components/workouts/WorkoutOverview';
import { useWorkoutSummary } from '@/hooks/useWorkoutSummary';
import { newId } from '@/domain/id';
import { templateFromWorkout } from '@/domain/template';
import { useUnitStore } from '@/store/useUnitStore';
import { useWorkoutHistory } from '@/store/useWorkoutHistory';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { useWorkoutSession } from '@/store/useWorkoutSession';
import { radius, useTheme } from '@/theme';

/** A logged workout: totals, PRs, every set. Edit, save as a template, or delete. */
export default function WorkoutDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unit = useUnitStore((s) => s.unit);
  const recent = useWorkoutHistory((s) => s.recent); // reload after an edit
  const { workout, summary } = useWorkoutSummary(id, recent);
  const { templates, saveTemplate } = useWorkoutLibraryStore();
  const [saved, setSaved] = useState(false);

  const edit = () => {
    const s = useWorkoutSession.getState();
    if (s.mode === 'live' && s.workout) return Alert.alert('Workout in progress', 'Finish or cancel it before editing a past workout.');
    router.push(`/workout?edit=${id}` as Href);
  };

  const saveAsTemplate = async () => {
    if (!workout) return;
    try {
      const base = { id: newId(), title: workout.title, notes: '', folderId: null, position: templates.length, exercises: [] };
      await saveTemplate(templateFromWorkout(base, workout, newId));
      setSaved(true);
    } catch (e) {
      notifyError(e, 'Could not save template');
    }
  };

  const remove = () =>
    Alert.alert('Delete workout?', `“${workout?.title}” and its sets will be removed from your history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          useWorkoutHistory
            .getState()
            .remove(id)
            .then(() => router.back())
            .catch((e) => notifyError(e, 'Could not delete')),
      },
    ]);

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
          <Pressable onPress={edit} hitSlop={10}>
            <Text style={{ color: t.accent, fontWeight: '700', fontSize: 16 }}>Edit</Text>
          </Pressable>
          <Pressable onPress={remove} hitSlop={10} accessibilityLabel="Delete workout">
            <Ionicons name="trash-outline" size={22} color={t.danger} />
          </Pressable>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24, gap: 14 }}>
        {workout === undefined ? (
          <Text style={{ color: t.textDim }}>Loading…</Text>
        ) : workout === null || !summary ? (
          <Text style={{ color: t.textDim }}>This workout could not be found.</Text>
        ) : (
          <>
            <WorkoutOverview workout={workout} summary={summary} unit={unit} />
            <Pressable
              onPress={saveAsTemplate}
              disabled={saved}
              style={[styles.btn, { backgroundColor: t.accentSoft, opacity: saved ? 0.6 : 1 }]}
            >
              <Text style={{ color: t.accent, fontWeight: '800' }}>{saved ? 'Saved to your templates' : 'Save as template'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  btn: { alignItems: 'center', paddingVertical: 14, borderRadius: radius.lg },
});
