import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { notifyError } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { totalsOf } from '@/domain/meal';
import { editSchedule, formatTime, parseTime, templateFromItems, WEEKDAY_NAMES, type MealSchedule } from '@/domain/mealSchedule';
import { useMealDraft } from '@/store/useMealDraft';
import { useMealStore } from '@/store/useMealStore';
import { radius, useTheme } from '@/theme';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const TIME_PRESETS = ['07:00', '08:00', '12:30', '16:00', '19:30', '21:00'];

export default function MealBuilder() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { saved, schedules, saveTemplate, updateTemplate, addSchedule, updateSchedule, removeSchedule } = useMealStore();
  const existing = id ? saved.find((m) => m.id === id) : undefined;
  const existingSchedule = existing ? schedules.find((s) => s.savedMealId === existing.id) : undefined;
  const items = useMealDraft((s) => s.items);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [auto, setAuto] = useState(!!existingSchedule?.enabled);
  const [timeText, setTimeText] = useState(existingSchedule?.time ?? '08:00');
  const [everyDay, setEveryDay] = useState(!existingSchedule?.days || existingSchedule.days.length === 0);
  const [days, setDays] = useState<number[]>(existingSchedule?.days?.length ? existingSchedule.days : [1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);

  // Start from the meal's items when editing, from an empty list when creating.
  useEffect(() => {
    useMealDraft.getState().reset(existing?.ingredients ?? []);
    return () => useMealDraft.getState().reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const time = parseTime(timeText);
  const tot = totalsOf(items);
  const canSave = !saving && items.length > 0 && title.trim().length > 0 && (!auto || (time !== null && (everyDay || days.length > 0)));

  const addFood = (mode: 'search' | 'scan') => router.push(`/scan?mode=${mode}&target=builder` as Href);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const tpl = templateFromItems(
        { id: existing?.id ?? newId(), createdAt: existing?.createdAt ?? new Date().toISOString() },
        title,
        items,
      );
      if (existing) await updateTemplate(tpl);
      else await saveTemplate(tpl);

      if (auto && time) {
        const base = { time, days: everyDay ? null : [...days].sort((a, b) => a - b) };
        if (existingSchedule) {
          await updateSchedule(editSchedule(existingSchedule, base, new Date().toISOString()));
        } else {
          const s: MealSchedule = { id: newId(), savedMealId: tpl.id, enabled: true, createdAt: new Date().toISOString(), lastApplied: null, ...base };
          await addSchedule(s);
        }
      } else if (existingSchedule) {
        await removeSchedule(existingSchedule.id);
      }
      router.back();
    } catch (e) {
      notifyError(e, 'Could not save', 'Could not save this meal. Please try again.');
      setSaving(false);
    }
  };

  const card = [styles.card, { backgroundColor: t.surface, borderColor: t.border }];

  return (
    <Screen padBottom>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.head}>
          <Text style={[styles.heading, { color: t.text }]}>{existing ? 'Edit meal' : 'New meal'}</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: t.accent, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={[styles.label, { color: t.textDim }]}>Name</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Protein shake"
            placeholderTextColor={t.textDim}
            maxLength={40}
            autoFocus={!existing}
            style={[styles.input, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
          />

          <Text style={[styles.label, { color: t.textDim }]}>Foods</Text>
          {items.length === 0 ? (
            <Text style={{ color: t.textDim, marginBottom: 8 }}>No foods yet. Search or scan to add items.</Text>
          ) : (
            <View style={card}>
              {items.map((it, i) => (
                <View key={`${it.name}-${i}`} style={[styles.itemRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={2}>
                      {it.name}
                    </Text>
                    <Text style={{ color: t.textDim, fontSize: 12 }}>
                      {it.estimated_quantity} · {it.calories} kcal · {it.protein_g} g P
                    </Text>
                  </View>
                  <Pressable onPress={() => useMealDraft.getState().remove(i)} hitSlop={10} accessibilityLabel={`Remove ${it.name}`}>
                    <Ionicons name="close-circle" size={22} color={t.textDim} />
                  </Pressable>
                </View>
              ))}
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '800', marginTop: 10 }}>
                {tot.calories} kcal · {tot.proteinG} g protein
              </Text>
              <Text style={{ color: t.textDim, fontSize: 12, marginTop: 2 }}>
                Carbs {tot.carbsG} g · Fat {tot.fatG} g
              </Text>
            </View>
          )}
          <View style={styles.row}>
            <Pressable onPress={() => addFood('search')} style={[styles.addBtn, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="search-outline" size={16} color={t.accent} />
              <Text style={{ color: t.accent, fontWeight: '700' }}>Search food</Text>
            </Pressable>
            <Pressable onPress={() => addFood('scan')} style={[styles.addBtn, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="barcode-outline" size={16} color={t.accent} />
              <Text style={{ color: t.accent, fontWeight: '700' }}>Scan barcode</Text>
            </Pressable>
          </View>

          <View style={[styles.switchRow, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Log automatically</Text>
              <Text style={{ color: t.textDim, fontSize: 12, marginTop: 2 }}>Added to your diary at the set time.</Text>
            </View>
            <Switch value={auto} onValueChange={setAuto} trackColor={{ true: t.accent }} />
          </View>

          {auto && (
            <>
              <Text style={[styles.label, { color: t.textDim }]}>Time (24 h)</Text>
              <TextInput
                value={timeText}
                onChangeText={setTimeText}
                placeholder="08:00"
                placeholderTextColor={t.textDim}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={[styles.input, { backgroundColor: t.surface, borderColor: time ? t.border : t.danger, color: t.text, marginBottom: 8 }]}
              />
              <View style={styles.chips}>
                {TIME_PRESETS.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setTimeText(p)}
                    style={[styles.chip, { backgroundColor: time === p ? t.accent : t.surface, borderColor: time === p ? t.accent : t.border }]}
                  >
                    <Text style={{ color: time === p ? '#fff' : t.text, fontWeight: '600', fontSize: 13 }}>{formatTime(p)}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.switchRow, { backgroundColor: t.surface, borderColor: t.border, marginTop: 16 }]}>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Every day</Text>
                <Switch value={everyDay} onValueChange={setEveryDay} trackColor={{ true: t.accent }} />
              </View>
              {!everyDay && (
                <View style={styles.chips}>
                  {WEEKDAY_NAMES.map((label, i) => {
                    const on = days.includes(i);
                    return (
                      <Pressable
                        key={label}
                        onPress={() => setDays(on ? days.filter((d) => d !== i) : [...days, i])}
                        style={[styles.chip, { backgroundColor: on ? t.accent : t.surface, borderColor: on ? t.accent : t.border }]}
                      >
                        <Text style={{ color: on ? '#fff' : t.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <Text style={{ color: t.textDim, fontSize: 12, marginTop: 12 }}>
                iOS can’t run the app in the background, so the meal is logged (stamped at the set time) the next time you open Compound after that time. Only today is logged; missed days are skipped. A schedule starts from its next occurrence.
              </Text>
            </>
          )}
        </ScrollView>

        <Pressable
          disabled={!canSave}
          onPress={save}
          style={[styles.save, { backgroundColor: t.success, opacity: canSave ? 1 : 0.4 }]}
        >
          <Text style={{ color: '#06231B', fontWeight: '800' }}>{existing ? 'Save changes' : 'Save meal'}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heading: { fontSize: 28, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 14, fontSize: 17, marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: radius.md, padding: 14, marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 20, flexWrap: 'wrap' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: radius.md, borderWidth: 1, marginBottom: 16 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1 },
  save: { borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
});
