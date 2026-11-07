import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { addDays, todayKey } from '@/domain/date';
import { dayTotals, macroGoals } from '@/domain/meal';
import { formatDays, formatTime } from '@/domain/mealSchedule';
import { useMealStore } from '@/store/useMealStore';
import { radius, useTheme, type Theme } from '@/theme';

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const fmtN = (n: number) => Math.round(n * 10) / 10;

export default function MealsScreen() {
  const t = useTheme();
  const { meals, saved, schedules, goals } = useMealStore();
  const today = todayKey();
  const todays = useMemo(() => meals.filter((m) => m.date === today), [meals, today]);
  const totals = dayTotals(todays);
  const targets = goals ? macroGoals(goals) : null;
  const weekAvg = useMemo(() => {
    const from = addDays(today, -7);
    const past = meals.filter((m) => m.date >= from && m.date < today);
    const days = new Set(past.map((m) => m.date)).size;
    return days ? Math.round(past.reduce((a, m) => a + m.calories, 0) / days) : null;
  }, [meals, today]);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.text }]}>Meals</Text>
          <Pressable
            onPress={() => router.push('/meal-settings' as Href)}
            hitSlop={12}
            style={[styles.iconBtn, { backgroundColor: t.surfaceAlt }]}
            accessibilityLabel="Meal settings"
          >
            <Ionicons name="settings-outline" size={18} color={t.text} />
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

        <Pressable
          onPress={() => {
            tap();
            router.push('/diary' as Href);
          }}
          style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <Ionicons name="book-outline" size={20} color={t.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>Diary</Text>
            <Text style={{ color: t.textDim, fontSize: 12 }}>
              {todays.length === 0 ? 'Nothing logged yet' : `${todays.length} ${todays.length === 1 ? 'item' : 'items'} today · by meal`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={t.textDim} />
        </Pressable>

        <Pressable
          onPress={() => {
            tap();
            router.push('/log-meal' as Href);
          }}
          style={[styles.logBtn, { backgroundColor: t.accent }]}
          accessibilityLabel="Log food"
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Log food</Text>
        </Pressable>

        {/* Created meals */}
        <View style={styles.listHead}>
          <Text style={[styles.section, { color: t.textDim }]}>MY MEALS</Text>
          <Pressable
            onPress={() => router.push('/meal-builder' as Href)}
            hitSlop={10}
            accessibilityLabel="Create a meal"
            style={styles.newMeal}
          >
            <Ionicons name="add-circle-outline" size={16} color={t.accent} />
            <Text style={{ color: t.accent, fontSize: 13, fontWeight: '700' }}>New meal</Text>
          </Pressable>
        </View>
        {saved.length === 0 ? (
          <Text style={{ color: t.textDim, fontSize: 13 }}>
            Combine foods you repeat (e.g. a protein shake) into one meal, then log it in a tap or on a schedule.
          </Text>
        ) : (
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, paddingVertical: 6 }]}>
            {saved.map((m, i) => {
              const sched = schedules.find((s) => s.savedMealId === m.id && s.enabled);
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    tap();
                    router.push(`/saved-meal?id=${m.id}` as Href);
                  }}
                  style={[styles.mealRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}
                  accessibilityLabel={`Open ${m.title}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                      {m.title}
                    </Text>
                    <Text style={{ color: t.textDim, fontSize: 12 }} numberOfLines={1}>
                      {m.ingredients.length} {m.ingredients.length === 1 ? 'item' : 'items'} · {m.proteinG} g protein
                      {sched ? ` · ${formatDays(sched.days)} ${formatTime(sched.time)}` : ''}
                    </Text>
                  </View>
                  {sched && <Ionicons name="time-outline" size={14} color={t.accent} />}
                  <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>{m.calories}</Text>
                  <Ionicons name="chevron-forward" size={16} color={t.textDim} />
                </Pressable>
              );
            })}
          </View>
        )}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, marginTop: 10 },
  logBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, paddingVertical: 16, marginTop: 14 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  newMeal: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
});
