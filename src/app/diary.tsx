import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { addDays, fromKey, todayKey } from '@/domain/date';
import { dayTotals, MEAL_SLOTS, type Meal, type MealSlot } from '@/domain/meal';
import { useMealStore } from '@/store/useMealStore';
import { radius, useTheme } from '@/theme';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function DiaryScreen() {
  const t = useTheme();
  const { meals, add, update, remove } = useMealStore();
  const today = todayKey();
  const [date, setDate] = useState(today);
  const [open, setOpen] = useState<string | null>(null);

  const dayMeals = useMemo(() => meals.filter((m) => m.date === date), [meals, date]);
  const total = dayTotals(dayMeals).calories;
  const sections = MEAL_SLOTS.map((s) => ({ ...s, items: dayMeals.filter((m) => m.slot === s.key) }));
  const isToday = date === today;
  const title = isToday
    ? 'Today'
    : date === addDays(today, -1)
      ? 'Yesterday'
      : fromKey(date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const relog = (m: Meal) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Always logs to today, in the same section as the original.
    add({ ...m, id: newId(), date: today, loggedAt: new Date().toISOString() }).catch(console.error);
  };

  const moveTo = (m: Meal) =>
    Alert.alert('Move to…', m.title, [
      ...MEAL_SLOTS.filter((s) => s.key !== m.slot).map((s) => ({
        text: s.label,
        onPress: () => update({ ...m, slot: s.key }).catch(console.error),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const confirmDelete = (m: Meal) =>
    Alert.alert('Delete meal?', m.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(m.id).catch(console.error) },
    ]);

  const addTo = (s: MealSlot) => {
    tap();
    router.push(`/scan?slot=${s}&mode=search` as Href);
  };

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Text style={[styles.title, { color: t.text }]}>Diary</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>Close</Text>
        </Pressable>
      </View>

      <View style={styles.dateRow}>
        <Pressable onPress={() => setDate((d) => addDays(d, -1))} hitSlop={12} accessibilityLabel="Previous day">
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
          <Text style={{ color: t.textDim, fontSize: 12 }}>{total.toLocaleString()} cal</Text>
        </View>
        <Pressable
          onPress={() => setDate((d) => addDays(d, 1))}
          disabled={isToday}
          hitSlop={12}
          accessibilityLabel="Next day"
          style={{ opacity: isToday ? 0.25 : 1 }}
        >
          <Ionicons name="chevron-forward" size={22} color={t.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {sections.map((sec) => {
          const kcal = Math.round(sec.items.reduce((a, m) => a + m.calories, 0));
          return (
            <View key={sec.key} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={styles.secHead}>
                <Text style={{ color: t.text, fontSize: 17, fontWeight: '800', flex: 1 }}>{sec.label}</Text>
                <Text style={{ color: t.textDim, fontSize: 14, fontWeight: '600' }}>{kcal.toLocaleString()} cal</Text>
                {isToday && (
                  <Pressable
                    onPress={() => addTo(sec.key)}
                    hitSlop={8}
                    style={[styles.addBtn, { backgroundColor: t.accentSoft }]}
                    accessibilityLabel={`Add to ${sec.label}`}
                  >
                    <Ionicons name="add" size={18} color={t.accent} />
                  </Pressable>
                )}
              </View>
              {sec.items.map((m) => (
                <View key={m.id} style={[styles.divider, { borderColor: t.border }]}>
                  <Pressable
                    onPress={() => setOpen((o) => (o === m.id ? null : m.id))}
                    onLongPress={() => {
                      tap();
                      Alert.alert(m.title, undefined, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Log again', onPress: () => relog(m) },
                        { text: 'Move to…', onPress: () => setTimeout(() => moveTo(m), 300) }, // let the first alert dismiss
                        { text: 'Delete', style: 'destructive', onPress: () => remove(m.id).catch(console.error) },
                      ]);
                    }}
                    style={styles.logRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontSize: 16 }} numberOfLines={1}>
                        {m.title}
                      </Text>
                      <Text style={{ color: t.textDim, fontSize: 12 }}>
                        {timeOf(m.loggedAt)} · {m.proteinG} g protein
                      </Text>
                    </View>
                    <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{m.calories}</Text>
                  </Pressable>
                  {open === m.id && (
                    <View style={styles.detail}>
                      {m.ingredients.map((i, k) => (
                        <Text key={k} style={{ color: t.textDim, fontSize: 12, marginTop: k ? 2 : 0 }}>
                          {i.name}
                          {i.estimated_quantity ? ` · ${i.estimated_quantity}` : ''} · {i.calories} kcal
                        </Text>
                      ))}
                      <View style={styles.detailActions}>
                        <Pressable onPress={() => relog(m)} hitSlop={8}>
                          <Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>Log again</Text>
                        </Pressable>
                        <Pressable onPress={() => moveTo(m)} hitSlop={8}>
                          <Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>Move</Text>
                        </Pressable>
                        <Pressable onPress={() => confirmDelete(m)} hitSlop={8}>
                          <Text style={{ color: t.danger, fontSize: 13, fontWeight: '600' }}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 4 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 6, marginBottom: 14 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  addBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  detail: { paddingBottom: 12 },
  detailActions: { flexDirection: 'row', gap: 20, marginTop: 10 },
});
