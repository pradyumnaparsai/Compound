import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '@/components/ProgressBar';
import { DiarySections } from '@/components/DiarySections';
import { Screen } from '@/components/Screen';
import { addDays, dayTitle, todayKey } from '@/domain/date';
import { useToday } from '@/hooks/useToday';
import { dayTotals, macroGoals } from '@/domain/meal';
import { useDiaryDate } from '@/store/useDiaryDate';
import { useMealStore } from '@/store/useMealStore';
import { radius, useTheme, type Theme } from '@/theme';

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const fmtN = (n: number) => Math.round(n * 10) / 10;

export default function MealsScreen() {
  const t = useTheme();
  const { meals, goals } = useMealStore();
  const today = useToday();
  // The tab stays mounted: keep following "today" unless the user stepped to another day.
  const picked = useDiaryDate((s) => s.picked);
  const setPicked = useDiaryDate((s) => s.setPicked);
  const date = picked ?? today;
  const isToday = date === today;
  const step = (n: number) => {
    const next = addDays(useDiaryDate.getState().picked ?? todayKey(), n);
    setPicked(next === todayKey() ? null : next);
  };
  const dayMeals = useMemo(() => meals.filter((m) => m.date === date), [meals, date]);
  const totals = dayTotals(dayMeals);
  const targets = goals ? macroGoals(goals) : null;
  const weekAvg = useMemo(() => {
    const from = addDays(today, -7);
    const past = meals.filter((m) => m.date >= from && m.date < today);
    const days = new Set(past.map((m) => m.date)).size;
    return days ? Math.round(past.reduce((a, m) => a + m.calories, 0) / days) : null;
  }, [meals, today]);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: 96 }} // clear of the floating "Log food" button
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.text }]}>Meals</Text>
          <Pressable
            onPress={() => router.push('/meal-target' as Href)}
            hitSlop={12}
            style={[styles.iconBtn, { backgroundColor: t.surfaceAlt }]}
            accessibilityLabel="Meal target"
          >
            <MaterialCommunityIcons name="bullseye-arrow" size={20} color={t.text} />
          </Pressable>
        </View>

        <View style={styles.dateRow}>
          <Pressable onPress={() => { tap(); step(-1); }} hitSlop={12} accessibilityLabel="Previous day">
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>
          <Pressable onPress={() => setPicked(null)} disabled={isToday} accessibilityLabel="Back to today" style={{ alignItems: 'center' }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{dayTitle(date, today)}</Text>
            {!isToday && <Text style={{ color: t.accent, fontSize: 12, fontWeight: '600' }}>Back to today</Text>}
          </Pressable>
          <Pressable onPress={() => { tap(); step(1); }} hitSlop={12} accessibilityLabel="Next day">
            <Ionicons name="chevron-forward" size={22} color={t.text} />
          </Pressable>
        </View>

        {/* Summary */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardLabel, { color: t.textDim }]}>Calories</Text>
          <View style={styles.calRow}>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', flexShrink: 1 }}>
              {totals.calories.toLocaleString()}
              {targets ? <Text style={[styles.unitSm, { color: t.textDim }]}>{` / ${targets.calories.toLocaleString()} cal`}</Text> : <Text style={styles.unitSm}> cal</Text>}
            </Text>
            {targets && (
              <Text style={{ color: totals.calories > targets.calories ? t.danger : t.textDim, fontSize: 13, fontWeight: '600' }}>
                {Math.abs(targets.calories - totals.calories).toLocaleString()} {totals.calories > targets.calories ? 'over' : 'left'}
              </Text>
            )}
          </View>
          <ProgressBar
            value={targets ? totals.calories / targets.calories : 0}
            height={8}
            color={targets && totals.calories > targets.calories ? t.danger : t.success}
          />
          {weekAvg !== null && (
            <Text style={{ color: t.textDim, fontSize: 12, marginTop: 10 }}>7-day avg {weekAvg.toLocaleString()} cal</Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, marginTop: 10 }]}>
          <View style={styles.macroRow}>
            <MacroCol t={t} label="Carbs" value={totals.carbsG} goal={targets?.carbsG} />
            <MacroCol t={t} label="Fat" value={totals.fatG} goal={targets?.fatG} />
            <MacroCol t={t} label="Protein" value={totals.proteinG} goal={targets?.proteinG} />
          </View>
        </View>

        <DiarySections meals={dayMeals} />
      </ScrollView>
    </Screen>
  );
}

function MacroCol({ t, label, value, goal }: { t: Theme; label: string; value: number; goal?: number }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: t.textDim, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '800', marginTop: 2 }}>
        {fmtN(value).toLocaleString()}
        <Text style={[styles.unitXs, { color: t.textDim }]}>{goal !== undefined ? ` / ${goal.toLocaleString()} g` : ' g'}</Text>
      </Text>
      <View style={{ marginTop: 8 }}>
        <ProgressBar value={goal ? value / goal : 0} height={6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '800' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: 18 },
  cardLabel: { fontSize: 13, fontWeight: '600' },
  calRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4, marginBottom: 10 },
  unitSm: { fontSize: 13, fontWeight: '600' },
  unitXs: { fontSize: 12, fontWeight: '600' },
  macroRow: { flexDirection: 'row', gap: 14 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 4 },
});
