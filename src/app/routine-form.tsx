import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { notifyError } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { DEFAULT_STEP_TARGET, MEAL_CALORIE_SLACK, MEAL_PROTEIN_SLACK } from '@/domain/goal';
import type { Goal, Recurrence } from '@/domain/types';
import { useMealStore } from '@/store/useMealStore';
import { useRoutineStore } from '@/store/useRoutineStore';
import { radius, useTheme } from '@/theme';

type GoalKind = 'none' | 'steps' | 'workout' | 'protein' | 'meal';
const GOAL_OPTIONS: { kind: GoalKind; label: string }[] = [
  { kind: 'none', label: 'Manual' },
  { kind: 'steps', label: 'Steps' },
  { kind: 'workout', label: 'Strength' },
  { kind: 'protein', label: 'Protein' },
  { kind: 'meal', label: 'Meals' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RoutineForm() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { routines, addRoutine, updateRoutine } = useRoutineStore();
  const existing = id ? routines.find((r) => r.id === id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [daily, setDaily] = useState(existing ? existing.recurrence.type === 'daily' : true);
  const [days, setDays] = useState<number[]>(
    existing?.recurrence.type === 'weekly' ? existing.recurrence.days : [1, 2, 3, 4, 5],
  );

  const [goalKind, setGoalKind] = useState<GoalKind>(existing?.goal?.type ?? 'none');
  const [stepText, setStepText] = useState(
    String(existing?.goal?.type === 'steps' ? existing.goal.target : DEFAULT_STEP_TARGET),
  );
  const stepTarget = Number(stepText.replace(/[^0-9]/g, ''));

  const dailyProtein = useMealStore((s) => s.goals?.proteinG);
  const [proteinText, setProteinText] = useState(
    String(existing?.goal?.type === 'protein' ? existing.goal.target : (dailyProtein ?? 100)),
  );
  const proteinTarget = Number(proteinText.replace(/[^0-9]/g, ''));

  const mealGoals = useMealStore((s) => s.goals);
  const existingMeal = existing?.goal?.type === 'meal' ? existing.goal : undefined;
  const [mealCalText, setMealCalText] = useState(String(existingMeal?.calories ?? mealGoals?.calories ?? ''));
  const [mealProteinText, setMealProteinText] = useState(String(existingMeal?.proteinG ?? mealGoals?.proteinG ?? ''));
  const mealCalories = Number(mealCalText.replace(/[^0-9]/g, ''));
  const mealProtein = Number(mealProteinText.replace(/[^0-9]/g, ''));

  const canSave =
    title.trim().length > 0 && (daily || days.length > 0) && (goalKind !== 'steps' || stepTarget >= 100) &&
    (goalKind !== 'protein' || (proteinTarget >= 10 && proteinTarget <= 500)) &&
    (goalKind !== 'meal' || (mealCalories >= 500 && mealCalories <= 10000 && mealProtein >= 10 && mealProtein <= 500));

  const save = async () => {
    const recurrence: Recurrence = daily ? { type: 'daily' } : { type: 'weekly', days };
    const goal: Goal | null =
      goalKind === 'steps'
        ? { type: 'steps', target: stepTarget }
        : goalKind === 'workout'
          ? { type: 'workout' }
          : goalKind === 'protein'
            ? { type: 'protein', target: proteinTarget }
            : goalKind === 'meal'
              ? { type: 'meal', calories: mealCalories, proteinG: mealProtein }
              : null;
    try {
      if (existing) await updateRoutine(existing.id, { title, recurrence, goal });
      else await addRoutine({ title, recurrence, goal });
      router.back();
    } catch (e) {
      notifyError(e, 'Could not save', 'Could not save this routine. Please try again.');
    }
  };

  return (
    <Screen padBottom dismissKeyboardOnTap>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={[styles.heading, { color: t.text }]}>{existing ? 'Edit routine' : 'New routine'}</Text>

        <Text style={[styles.label, { color: t.textDim }]}>Name</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Read 20 pages"
          placeholderTextColor={t.textDim}
          autoFocus={!existing}
          maxLength={80}
          style={[styles.input, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
        />

        <View style={[styles.switchRow, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Every day</Text>
          <Switch value={daily} onValueChange={setDaily} trackColor={{ true: t.accent }} />
        </View>

        {!daily && (
          <View style={styles.chips}>
            {DAYS.map((label, i) => {
              const on = days.includes(i);
              return (
                <Pressable
                  key={label}
                  onPress={() => setDays(on ? days.filter((d) => d !== i) : [...days, i])}
                  style={[
                    styles.chip,
                    { backgroundColor: on ? t.accent : t.surface, borderColor: on ? t.accent : t.border },
                  ]}
                >
                  <Text style={{ color: on ? '#fff' : t.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[styles.label, { color: t.textDim, marginTop: 20 }]}>Completed by</Text>
        <View style={[styles.seg, { backgroundColor: t.surfaceAlt }]}>
          {GOAL_OPTIONS.map((o) => (
            <Pressable
              key={o.kind}
              onPress={() => setGoalKind(o.kind)}
              style={[styles.segItem, goalKind === o.kind && { backgroundColor: t.accent }]}
            >
              <Text style={{ color: goalKind === o.kind ? '#fff' : t.textDim, fontWeight: '700', fontSize: 13 }}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        {goalKind === 'steps' && (
          <View style={[styles.switchRow, { backgroundColor: t.surface, borderColor: t.border, marginTop: 12 }]}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Daily steps</Text>
            <TextInput
              value={stepText}
              onChangeText={setStepText}
              keyboardType="number-pad"
              style={{ color: t.text, fontSize: 20, fontWeight: '700', minWidth: 90, textAlign: 'right' }}
            />
          </View>
        )}
        {goalKind === 'protein' && (
          <View style={[styles.switchRow, { backgroundColor: t.surface, borderColor: t.border, marginTop: 12 }]}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Daily protein (g)</Text>
            <TextInput
              value={proteinText}
              onChangeText={setProteinText}
              keyboardType="number-pad"
              style={{ color: t.text, fontSize: 20, fontWeight: '700', minWidth: 90, textAlign: 'right' }}
            />
          </View>
        )}
        {goalKind === 'meal' && (
          <>
            <View style={[styles.switchRow, { backgroundColor: t.surface, borderColor: t.border, marginTop: 12, marginBottom: 8 }]}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Daily calories</Text>
              <TextInput
                value={mealCalText}
                onChangeText={setMealCalText}
                keyboardType="number-pad"
                style={{ color: t.text, fontSize: 20, fontWeight: '700', minWidth: 90, textAlign: 'right' }}
              />
            </View>
            <View style={[styles.switchRow, { backgroundColor: t.surface, borderColor: t.border, marginBottom: 0 }]}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Daily protein (g)</Text>
              <TextInput
                value={mealProteinText}
                onChangeText={setMealProteinText}
                keyboardType="number-pad"
                style={{ color: t.text, fontSize: 20, fontWeight: '700', minWidth: 90, textAlign: 'right' }}
              />
            </View>
          </>
        )}
        {goalKind !== 'none' && (
          <Text style={{ color: t.textDim, fontSize: 12, marginTop: 8 }}>
            {goalKind === 'steps'
              ? 'Checks itself off when Apple Health shows you reached the step goal.'
              : goalKind === 'protein'
                ? 'Checks itself off when the protein you log in the Meals tab reaches this amount for the day.'
                : goalKind === 'meal'
                  ? `Checks itself off the day after, if that day’s logged calories were at most ${MEAL_CALORIE_SLACK} over and protein at most ${MEAL_PROTEIN_SLACK} g under these targets.`
                  : 'Checks itself off once a Traditional Strength Training workout is logged in Apple Health that day.'}{' '}
            You can’t tick it by hand.
          </Text>
        )}

        <View style={{ flex: 1 }} />
        <View style={styles.actions}>
          <Pressable onPress={() => router.back()} style={[styles.btn, { backgroundColor: t.surfaceAlt }]}>
            <Text style={{ color: t.text, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
          <Pressable
            disabled={!canSave}
            onPress={save}
            style={[styles.btn, { backgroundColor: t.accent, opacity: canSave ? 1 : 0.4 }]}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', borderRadius: radius.pill, padding: 3 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  heading: { fontSize: 28, fontWeight: '800', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 16, fontSize: 17, marginBottom: 20 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: radius.md, borderWidth: 1, marginBottom: 16 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: radius.md },
});
