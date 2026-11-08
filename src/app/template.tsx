import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation, usePreventRemove, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip, ChipRow } from '@/components/Chip';
import { notifyError } from '@/components/notify';
import { ReorderableList } from '@/components/ReorderableList';
import { Screen } from '@/components/Screen';
import { TemplateExerciseCard } from '@/components/workouts/TemplateExerciseCard';
import { exerciseMap } from '@/domain/exerciseCatalog';
import { supersetBadges } from '@/domain/workout';
import { useTemplateDraft } from '@/store/useTemplateDraft';
import { useUnitStore } from '@/store/useUnitStore';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { radius, useTheme } from '@/theme';

/** Template builder. The draft lives in `useTemplateDraft` so the exercise picker can add to it and return. */
export default function TemplateScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const { id, folder } = useLocalSearchParams<{ id?: string; folder?: string }>();
  const { templates, folders, customs, saveTemplate, removeTemplate } = useWorkoutLibraryStore();
  const unit = useUnitStore((s) => s.unit);
  const existing = id ? templates.find((x) => x.id === id) : undefined;
  const draft = useTemplateDraft((s) => s.draft);
  const [saving, setSaving] = useState(false);
  const dirty = useTemplateDraft((s) => !!s.draft && s.initial !== null && JSON.stringify(s.draft) !== s.initial);

  useEffect(() => {
    const folderId = folder && folders.some((f) => f.id === folder) ? folder : null;
    useTemplateDraft.getState().start(existing ?? null, templates.length, folderId);
    return () => useTemplateDraft.getState().clear();
    // Start once per opened template; later store changes must not reset what the user typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);


  // Ask before discarding edits (back button, swipe, Cancel). `saving` stays true once we are leaving on purpose.
  usePreventRemove(dirty && !saving, ({ data }) =>
    Alert.alert('Discard changes?', 'Your edits to this template will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => nav.dispatch(data.action) },
    ]),
  );

  const defs = useMemo(() => exerciseMap(customs), [customs]);
  const badges = useMemo(() => supersetBadges(draft?.exercises ?? []), [draft?.exercises]);

  if (!draft) return <Screen>{null}</Screen>;

  const canSave = !saving && draft.title.trim().length > 0 && draft.exercises.length > 0;
  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await saveTemplate({ ...draft, title: draft.title.trim() });
      router.back();
    } catch (e) {
      notifyError(e, 'Could not save', 'Could not save this template. Please try again.');
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete template?', `"${draft.title || 'This template'}" will be removed. Logged workouts are kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            await removeTemplate(draft.id);
            router.back();
          } catch (e) {
            notifyError(e, 'Could not delete');
            setSaving(false);
          }
        },
      },
    ]);

  const d = useTemplateDraft.getState;

  const header = (
    <View style={{ gap: 10, marginBottom: 12 }}>
      <TextInput
        value={draft.title}
        onChangeText={(title) => d().setMeta({ title })}
        placeholder="Template name, e.g. Push day"
        placeholderTextColor={t.textDim}
        maxLength={40}
        autoFocus={!existing && draft.exercises.length === 0}
        style={[styles.title, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
      />
      <TextInput
        value={draft.notes}
        onChangeText={(notes) => d().setMeta({ notes })}
        placeholder="Notes (optional)"
        placeholderTextColor={t.textDim}
        multiline
        style={[styles.notes, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
      />
      {folders.length > 0 && (
        <ChipRow>
          {[{ id: null as string | null, title: 'No folder' }, ...folders].map((f) => (
            <Chip key={f.id ?? 'none'} label={f.title} on={draft.folderId === f.id} onPress={() => d().setMeta({ folderId: f.id })} />
          ))}
        </ChipRow>
      )}
    </View>
  );

  return (
    <Screen padBottom>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.head}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={t.text} />
          </Pressable>
          <Text style={[styles.heading, { color: t.text }]}>{existing ? 'Edit template' : 'New template'}</Text>
          {existing ? (
            <Pressable onPress={remove} hitSlop={12} accessibilityLabel="Delete template">
              <Ionicons name="trash-outline" size={22} color={t.danger} />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
        </View>

        <ReorderableList
          data={draft.exercises}
          header={header}
          contentContainerStyle={{ paddingBottom: 16 }}
          onReorder={(ids) => d().reorderExercises(ids)}
          empty={<Text style={{ color: t.textDim, marginBottom: 12 }}>No exercises yet. Add one to plan your sets.</Text>}
          renderItem={(e, drag) => {
            const i = draft.exercises.findIndex((x) => x.id === e.id);
            return (
              <TemplateExerciseCard
                exercise={e}
                def={defs.get(e.exerciseId)}
                badge={badges[i] ?? null}
                canLinkNext={i >= 0 && i < draft.exercises.length - 1}
                unit={unit}
                drag={drag}
              />
            );
          }}
        />

        <View style={styles.bar}>
          <Pressable onPress={() => router.push('/exercises?pick=1' as Href)} style={[styles.barBtn, { backgroundColor: t.accentSoft }]}>
            <Ionicons name="add" size={18} color={t.accent} />
            <Text style={{ color: t.accent, fontWeight: '800' }}>Add exercise</Text>
          </Pressable>
          <Pressable disabled={!canSave} onPress={save} style={[styles.barBtn, { backgroundColor: t.accent, opacity: canSave ? 1 : 0.4 }]}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: '800' },
  title: { borderWidth: 1, borderRadius: radius.md, padding: 14, fontSize: 20, fontWeight: '700' },
  notes: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, minHeight: 44 },
  bar: { flexDirection: 'row', gap: 10, paddingTop: 8 },
  barBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 15, borderRadius: radius.lg },
});
