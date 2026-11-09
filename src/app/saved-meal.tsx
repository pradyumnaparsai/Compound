import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notifyError } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { dateParam, dayTitle, todayKey } from '@/domain/date';
import { MEAL_SLOTS, mealFromSaved, slotForTime, slotLabel, totalsOf, type MealSlot } from '@/domain/meal';
import { formatDays, formatTime } from '@/domain/mealSchedule';
import { useMealStore } from '@/store/useMealStore';
import { radius, useTheme } from '@/theme';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** A saved meal: review what's in it, pick Breakfast/Lunch/Snacks/Dinner, then add it to the day's diary. */
export default function SavedMealScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[]; date?: string | string[] }>();
  const date = dateParam(params.date);
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { saved, schedules, add, removeTemplate } = useMealStore();
  const meal = saved.find((m) => m.id === id);
  const sched = meal ? schedules.find((s) => s.savedMealId === meal.id && s.enabled) : undefined;
  const [slot, setSlot] = useState<MealSlot>(() => slotForTime(new Date()));
  const [busy, setBusy] = useState(false);

  const addToDiary = async () => {
    if (!meal || busy) return;
    setBusy(true);
    try {
      await add(mealFromSaved(meal, slot, date, new Date(), newId()));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.dismissTo('/(tabs)/meals' as Href); // land on the Meals tab with the day updated
    } catch (e) {
      notifyError(e, 'Could not log', 'Could not log this meal. Please try again.');
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!meal) return;
    Alert.alert('Delete saved meal?', sched ? `${meal.title} and its schedule.` : meal.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          removeTemplate(meal.id)
            .then(() => router.back())
            .catch((e) => notifyError(e, 'Could not delete', 'Could not delete this meal. Please try again.')),
      },
    ]);
  };

  const tot = meal ? totalsOf(meal.ingredients) : null;

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
          {meal?.title ?? 'Meal'}
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Text style={{ color: t.accent, fontWeight: '600' }}>Close</Text>
        </Pressable>
      </View>

      {!meal || !tot ? (
        <Text style={{ color: t.textDim, fontSize: 15 }}>This meal no longer exists.</Text>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={{ color: t.text, fontSize: 26, fontWeight: '800' }}>
                {tot.calories} <Text style={styles.unit}>kcal</Text>
              </Text>
              <Text style={{ color: t.textDim, fontSize: 13, marginTop: 2 }}>
                {tot.proteinG} g protein · {tot.carbsG} g carbs · {tot.fatG} g fat
              </Text>
              {sched && (
                <View style={styles.schedRow}>
                  <Ionicons name="time-outline" size={14} color={t.accent} />
                  <Text style={{ color: t.accent, fontSize: 12, fontWeight: '600' }}>
                    Auto-logs {formatDays(sched.days).toLowerCase()} at {formatTime(sched.time)}
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.section, { color: t.textDim }]}>WHAT’S IN IT</Text>
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, paddingVertical: 6 }]}>
              {meal.ingredients.map((ing, i) => (
                <View key={`${ing.name}-${i}`} style={[styles.ing, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontSize: 15 }} numberOfLines={2}>
                      {ing.name}
                    </Text>
                    {ing.estimated_quantity ? <Text style={{ color: t.textDim, fontSize: 12 }}>{ing.estimated_quantity}</Text> : null}
                  </View>
                  <Text style={{ color: t.textDim, fontSize: 14 }}>{ing.calories}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.section, { color: t.textDim }]}>ADD TO</Text>
            <View style={styles.slotRow}>
              {MEAL_SLOTS.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setSlot(s.key);
                  }}
                  style={[styles.slotPill, { backgroundColor: slot === s.key ? t.accent : t.surfaceAlt }]}
                  accessibilityState={{ selected: slot === s.key }}
                >
                  <Text style={{ color: slot === s.key ? '#fff' : t.textDim, fontSize: 13, fontWeight: '700' }}>{s.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.links}>
              <Pressable onPress={() => router.push(`/meal-builder?id=${meal.id}` as Href)} hitSlop={8}>
                <Text style={{ color: t.accent, fontSize: 14, fontWeight: '600' }}>Edit meal</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} hitSlop={8}>
                <Text style={{ color: t.danger, fontSize: 14, fontWeight: '600' }}>Delete</Text>
              </Pressable>
            </View>
          </ScrollView>

          <Pressable
            disabled={busy}
            onPress={addToDiary}
            style={[styles.primary, { backgroundColor: t.success, opacity: busy ? 0.4 : 1 }]}
            accessibilityLabel={`Add to ${slotLabel(slot)}`}
          >
            <Text style={{ color: '#06231B', fontWeight: '800', fontSize: 16 }}>
              Add to {slotLabel(slot)}{date !== todayKey() ? ` · ${dayTitle(date)}` : ''}
            </Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', flex: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: 18 },
  unit: { fontSize: 14, fontWeight: '600' },
  schedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 20, marginBottom: 10 },
  ing: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  slotRow: { flexDirection: 'row', gap: 8 },
  slotPill: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  links: { flexDirection: 'row', gap: 24, marginTop: 24 },
  primary: { borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
});
