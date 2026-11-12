import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notifyError } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { WorkoutOverview } from '@/components/workouts/WorkoutOverview';
import { sqliteWorkoutRepo } from '@/data/sqliteWorkoutLogRepository';
import { workoutCongrats, type WorkoutCongrats } from '@/domain/celebrate';
import { useWorkoutSummary } from '@/hooks/useWorkoutSummary';
import { celebrate } from '@/store/useCelebration';
import { useWorkoutFocus } from '@/store/useWorkoutFocus';
import { exerciseMap } from '@/domain/exerciseCatalog';
import { diffTemplate, shouldOfferTemplateUpdate, templateFromWorkout } from '@/domain/template';
import { newId } from '@/domain/id';
import { useUnitStore } from '@/store/useUnitStore';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { radius, useTheme } from '@/theme';

/** Shown right after finishing: totals, PRs and, when the session differs from its template, "Update template?". */
export default function WorkoutSummaryScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unit = useUnitStore((s) => s.unit);
  const { workout, summary } = useWorkoutSummary(id);
  const { templates, customs, saveTemplate } = useWorkoutLibraryStore();
  const [answered, setAnswered] = useState<'updated' | 'kept' | null>(null);
  const names = useMemo(() => exerciseMap(customs), [customs]);

  const template = workout?.templateId ? templates.find((x) => x.id === workout.templateId) : undefined;
  const diff = useMemo(() => (template && workout ? diffTemplate(template, workout) : null), [template, workout]);
  const title = (id: string) => names.get(id)?.title ?? 'exercise';

  const update = async () => {
    if (!template || !workout) return;
    try {
      await saveTemplate(templateFromWorkout(template, workout, newId));
      setAnswered('updated');
    } catch (e) {
      notifyError(e, 'Could not update template');
    }
  };

  // "Nth workout" message + fireworks, once per opened summary.
  const [congrats, setCongrats] = useState<WorkoutCongrats | null>(null);
  const startedAt = workout?.startedAt;
  useEffect(() => {
    if (!startedAt) return;
    let alive = true;
    sqliteWorkoutRepo
      .countFinishedUpTo(startedAt)
      .then((n) => {
        const c = workoutCongrats(n);
        if (!alive || !c) return;
        setCongrats(c);
        celebrate('fireworks');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [startedAt]);

  // Land on Body → History with this workout on top, not on the templates.
  const done = () => {
    if (id) useWorkoutFocus.getState().highlight(id);
    router.replace('/(tabs)/body' as Href);
  };

  return (
    <Screen padBottom>
      <Text style={[styles.kicker, { color: t.success }]}>Workout complete</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24, gap: 14 }}>
        {workout === undefined ? (
          <Text style={{ color: t.textDim }}>Loading…</Text>
        ) : workout === null || !summary ? (
          <Text style={{ color: t.textDim }}>This workout could not be found.</Text>
        ) : (
          <>
            {congrats && (
              <View
                style={[styles.congrats, { backgroundColor: congrats.milestone ? t.accentSoft : t.surface, borderColor: congrats.milestone ? t.accent : t.border }]}
                accessibilityRole="header"
              >
                <Ionicons name={congrats.milestone ? 'trophy' : 'ribbon'} size={22} color={congrats.milestone ? '#F5B800' : t.accent} />
                <Text style={{ color: t.text, fontSize: 16, fontWeight: '800', flex: 1 }}>{congrats.text}</Text>
              </View>
            )}

            <WorkoutOverview workout={workout} summary={summary} unit={unit} />

            {template && diff && answered === null && (shouldOfferTemplateUpdate(diff) || diff.minor) && (
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.accent }]}>
                <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>
                  {diff.major ? `Update “${template.title}”?` : `Save today’s numbers to “${template.title}”?`}
                </Text>
                <Text style={{ color: t.textDim, fontSize: 14 }}>
                  {diff.major
                    ? [
                        diff.addedExerciseIds.length ? `Added: ${diff.addedExerciseIds.map(title).join(', ')}.` : '',
                        diff.removedExerciseIds.length ? `Not done: ${diff.removedExerciseIds.map(title).join(', ')}.` : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    : 'The sets, weights or reps differ from the template.'}
                </Text>
                <View style={styles.row}>
                  <Pressable onPress={update} style={[styles.btn, { backgroundColor: t.accent }]}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Update template</Text>
                  </Pressable>
                  <Pressable onPress={() => setAnswered('kept')} style={[styles.btn, { backgroundColor: t.surfaceAlt }]}>
                    <Text style={{ color: t.text, fontWeight: '700' }}>Keep template</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {answered === 'updated' && <Text style={{ color: t.success, fontWeight: '700' }}>Template updated.</Text>}
          </>
        )}
      </ScrollView>
      <Pressable onPress={done} style={[styles.cta, { backgroundColor: t.accent }]}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Done</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  card: { borderWidth: 1.5, borderRadius: radius.lg, padding: 14, gap: 10 },
  congrats: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: radius.lg, padding: 14 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.pill },
  cta: { alignItems: 'center', paddingVertical: 16, borderRadius: radius.lg, marginTop: 8 },
});
