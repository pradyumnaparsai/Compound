import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { onFail } from '@/components/notify';
import { dayTotals, MEAL_SLOTS, type Meal, renameMeal, withoutIngredient } from '@/domain/meal';
import { useMealStore } from '@/store/useMealStore';
import { radius, useTheme } from '@/theme';

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** The day's Breakfast / Lunch / Snacks / Dinner cards: expand an entry, edit its name, remove items, move or delete it. */
export function DiarySections({ meals }: { meals: Meal[] }) {
  const t = useTheme();
  const { update, remove } = useMealStore();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  // Leaving the tab (blur) collapses every expanded meal and ends any rename, so it opens fresh next time.
  useFocusEffect(
    useCallback(
      () => () => {
        setOpen(null);
        setEditing(null);
      },
      [],
    ),
  );

  const sections = MEAL_SLOTS.map((s) => ({ ...s, items: meals.filter((m) => m.slot === s.key) }));

  const startEdit = (m: Meal) => {
    tap();
    setOpen(m.id);
    setEditing(m.id);
    setDraftTitle(m.title);
  };

  const finishEdit = (m: Meal) => {
    const next = renameMeal(m, draftTitle);
    if (next !== m) update(next).catch(onFail());
    setEditing(null);
  };

  const moveTo = (m: Meal) =>
    Alert.alert('Move to…', m.title, [
      ...MEAL_SLOTS.filter((s) => s.key !== m.slot).map((s) => ({
        text: s.label,
        onPress: () => update({ ...m, slot: s.key }).catch(onFail()),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const confirmDelete = (m: Meal) =>
    Alert.alert('Delete meal?', m.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setEditing((e) => (e === m.id ? null : e));
          remove(m.id).catch(onFail());
        },
      },
    ]);

  const removeItem = (m: Meal, index: number) => {
    tap();
    const next = withoutIngredient(m, index);
    if (next) update(next).catch(onFail());
    else confirmDelete(m); // last item: removing it deletes the whole meal
  };

  return (
    <>
      {sections.map((sec) => {
        const kcal = dayTotals(sec.items).calories;
        return (
          <View key={sec.key} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.secHead}>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: '800', flex: 1 }}>{sec.label}</Text>
              <Text style={{ color: t.textDim, fontSize: 14, fontWeight: '600' }}>{kcal.toLocaleString()} cal</Text>
            </View>
            {sec.items.map((m) => {
              const isEditing = editing === m.id;
              return (
                <View key={m.id} style={[styles.divider, { borderColor: t.border }]}>
                  <Pressable
                    onPress={() => {
                      if (isEditing) return;
                      setOpen((o) => (o === m.id ? null : m.id));
                    }}
                    onLongPress={() => {
                      tap();
                      Alert.alert(m.title, undefined, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Edit', onPress: () => startEdit(m) },
                        { text: 'Move to…', onPress: () => setTimeout(() => moveTo(m), 300) }, // let the first alert dismiss
                        { text: 'Delete', style: 'destructive', onPress: () => remove(m.id).catch(onFail()) },
                      ]);
                    }}
                    style={styles.logRow}
                  >
                    <View style={{ flex: 1 }}>
                      {isEditing ? (
                        <TextInput
                          value={draftTitle}
                          onChangeText={setDraftTitle}
                          onSubmitEditing={() => finishEdit(m)}
                          autoFocus
                          selectTextOnFocus
                          returnKeyType="done"
                          maxLength={80}
                          placeholder="Meal name"
                          placeholderTextColor={t.textDim}
                          accessibilityLabel="Meal name"
                          style={[styles.titleInput, { color: t.text, backgroundColor: t.surfaceAlt }]}
                        />
                      ) : (
                        <Text style={{ color: t.text, fontSize: 16 }} numberOfLines={1}>
                          {m.title}
                        </Text>
                      )}
                      <Text style={{ color: t.textDim, fontSize: 12 }}>
                        {timeOf(m.loggedAt)} · {m.proteinG} g protein
                      </Text>
                    </View>
                    <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{m.calories}</Text>
                  </Pressable>
                  {open === m.id && (
                    <View style={styles.detail}>
                      {m.ingredients.map((i, k) => (
                        <View key={k} style={styles.ingRow}>
                          <Text style={{ color: t.textDim, fontSize: 12, flex: 1 }}>
                            {i.name}
                            {i.estimated_quantity ? ` · ${i.estimated_quantity}` : ''} · {i.calories} kcal
                          </Text>
                          {isEditing && (
                            <Pressable onPress={() => removeItem(m, k)} hitSlop={10} accessibilityLabel={`Remove ${i.name}`}>
                              <Ionicons name="remove-circle" size={22} color={t.danger} />
                            </Pressable>
                          )}
                        </View>
                      ))}
                      <View style={styles.detailActions}>
                        {isEditing ? (
                          <Pressable onPress={() => finishEdit(m)} hitSlop={8} accessibilityLabel="Done editing">
                            <Text style={{ color: t.success, fontSize: 13, fontWeight: '700' }}>Done</Text>
                          </Pressable>
                        ) : (
                          <Pressable onPress={() => startEdit(m)} hitSlop={8} accessibilityLabel={`Edit ${m.title}`}>
                            <Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>Edit</Text>
                          </Pressable>
                        )}
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
              );
            })}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 6, marginTop: 12 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  titleInput: { fontSize: 16, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4 },
  detail: { paddingBottom: 12 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  detailActions: { flexDirection: 'row', gap: 20, marginTop: 10 },
});
