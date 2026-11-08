import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip, ChipRow } from '@/components/Chip';
import { onFail } from '@/components/notify';
import { ReorderableList } from '@/components/ReorderableList';
import { Segmented } from '@/components/Segmented';
import { ActiveWorkoutBanner } from '@/components/workouts/ActiveWorkoutBanner';
import { HistoryPanel } from '@/components/workouts/HistoryPanel';
import { startWorkout } from '@/hooks/useStartWorkout';
import { exerciseMap } from '@/domain/exerciseCatalog';
import type { WorkoutTemplate } from '@/domain/workout';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { radius, useTheme } from '@/theme';

type Filter = 'all' | 'none' | string; // 'all' | 'none' (no folder) | folder id

const setCount = (t: WorkoutTemplate) => t.exercises.reduce((n, e) => n + e.sets.length, 0);

type Sub = 'templates' | 'history';

/** Workouts: the in-progress banner, then Templates (start a session) or History (what was logged). */
export function WorkoutsPanel() {
  const [sub, setSub] = useState<Sub>('templates');
  return (
    <View style={{ flex: 1 }}>
      <ActiveWorkoutBanner />
      <Segmented
        options={[
          { value: 'templates', label: 'Templates' },
          { value: 'history', label: 'History' },
        ]}
        value={sub}
        onChange={setSub}
      />
      {sub === 'templates' ? <TemplatesList /> : <HistoryPanel />}
    </View>
  );
}

/** Templates (planned sessions) with folder filters and drag reorder. */
function TemplatesList() {
  const t = useTheme();
  const { folders, templates, customs, reorderTemplates, duplicate, removeTemplate, addFolder, renameFolder, removeFolder, moveFolder } =
    useWorkoutLibraryStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [folderEdit, setFolderEdit] = useState<{ id: string | null; text: string } | null>(null);
  const names = useMemo(() => exerciseMap(customs), [customs]);

  const activeFilter: Filter = filter !== 'all' && filter !== 'none' && !folders.some((f) => f.id === filter) ? 'all' : filter;
  const visible = templates.filter((x) => (activeFilter === 'all' ? true : activeFilter === 'none' ? x.folderId === null : x.folderId === activeFilter));

  const openTemplate = (id?: string) =>
    router.push((id ? `/template?id=${id}` : `/template${activeFilter !== 'all' && activeFilter !== 'none' ? `?folder=${activeFilter}` : ''}`) as Href);

  const templateMenu = (x: WorkoutTemplate) =>
    Alert.alert(x.title || 'Template', undefined, [
      { text: 'Edit template', onPress: () => openTemplate(x.id) },
      { text: 'Duplicate', onPress: () => duplicate(x.id).catch(onFail()) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete template?', `"${x.title}" will be removed. Logged workouts are kept.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => removeTemplate(x.id).catch(onFail()) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const folderMenu = (id: string, title: string) =>
    Alert.alert(title, undefined, [
      { text: 'Rename', onPress: () => setFolderEdit({ id, text: title }) },
      { text: 'Move left', onPress: () => moveFolder(id, -1).catch(onFail()) },
      { text: 'Move right', onPress: () => moveFolder(id, 1).catch(onFail()) },
      {
        text: 'Delete folder',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete folder?', 'Its templates are kept and move out of the folder.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => removeFolder(id).catch(onFail()) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const saveFolder = async () => {
    if (!folderEdit || !folderEdit.text.trim()) return;
    try {
      if (folderEdit.id) await renameFolder(folderEdit.id, folderEdit.text);
      else setFilter((await addFolder(folderEdit.text)).id);
      setFolderEdit(null);
    } catch (e) {
      onFail()(e);
    }
  };

  const chip = (key: Filter, label: string, onLongPress?: () => void) => (
    <Chip key={key} label={label} on={activeFilter === key} onPress={() => setFilter(key)} onLongPress={onLongPress} />
  );

  const header = (
    <View>
      <View style={styles.actions}>
        <Pressable onPress={() => openTemplate()} style={[styles.primary, { backgroundColor: t.accent }]}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700' }}>New template</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/exercises' as Href)} style={[styles.secondary, { backgroundColor: t.accentSoft }]}>
          <Ionicons name="list-outline" size={18} color={t.accent} />
          <Text style={{ color: t.accent, fontWeight: '700' }}>Exercises</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/workout-settings' as Href)} hitSlop={10} accessibilityLabel="Workout settings">
          <Ionicons name="settings-outline" size={22} color={t.textDim} />
        </Pressable>
      </View>

      <ChipRow>
        {chip('all', 'All')}
        {folders.map((f) => chip(f.id, f.title, () => folderMenu(f.id, f.title)))}
        {templates.some((x) => x.folderId === null) && folders.length > 0 && chip('none', 'Unfiled')}
        <Chip label="+ Folder" dashed onPress={() => setFolderEdit({ id: null, text: '' })} />
      </ChipRow>

      {folderEdit && (
        <View style={styles.folderRow}>
          <TextInput
            value={folderEdit.text}
            onChangeText={(text) => setFolderEdit({ ...folderEdit, text })}
            placeholder="Folder name"
            placeholderTextColor={t.textDim}
            maxLength={30}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveFolder}
            style={[styles.folderInput, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
          />
          <Pressable onPress={saveFolder} hitSlop={8}>
            <Text style={{ color: t.accent, fontWeight: '700' }}>Save</Text>
          </Pressable>
          <Pressable onPress={() => setFolderEdit(null)} hitSlop={8}>
            <Text style={{ color: t.textDim, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <ReorderableList
      data={visible}
      header={header}
      contentContainerStyle={{ paddingBottom: 32 }}
      onReorder={(ids) => reorderTemplates(ids).catch(onFail())}
      empty={
        <Text style={{ color: t.textDim, marginTop: 12 }}>
          {templates.length === 0 ? 'No templates yet. Tap “New template” to plan a session.' : 'No templates in this folder.'}
        </Text>
      }
      renderItem={(x, drag) => {
        const folder = folders.find((f) => f.id === x.folderId);
        const exNames = x.exercises.map((e) => names.get(e.exerciseId)?.title ?? 'Unknown exercise');
        return (
          <Pressable
            onPress={() => openTemplate(x.id)}
            onLongPress={drag.onLongPress}
            onPressOut={drag.onPressOut}
            style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: t.text }]} numberOfLines={1}>
                {x.title || 'Untitled'}
              </Text>
              <Text style={{ color: t.textDim, fontSize: 13, marginTop: 2 }}>
                {x.exercises.length} exercise{x.exercises.length === 1 ? '' : 's'} · {setCount(x)} set{setCount(x) === 1 ? '' : 's'}
                {folder && activeFilter === 'all' ? ` · ${folder.title}` : ''}
              </Text>
              {exNames.length > 0 && (
                <Text style={{ color: t.textDim, fontSize: 12, marginTop: 6 }} numberOfLines={2}>
                  {exNames.join(' · ')}
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Pressable onPress={() => startWorkout(x)} style={[styles.start, { backgroundColor: t.accent }]} accessibilityRole="button" accessibilityLabel={`Start ${x.title}`}>
                <Ionicons name="play" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Start</Text>
              </Pressable>
              <Pressable onPress={() => templateMenu(x)} hitSlop={12} accessibilityLabel={`More actions for ${x.title}`}>
                <Ionicons name="ellipsis-horizontal" size={20} color={t.textDim} />
              </Pressable>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  start: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill },
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  folderInput: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
});
