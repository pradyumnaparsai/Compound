import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { onFail } from '@/components/notify';
import { ReorderableList } from '@/components/ReorderableList';
import { Screen } from '@/components/Screen';
import { VersionInfo } from '@/components/VersionInfo';
import { goalLabel } from '@/domain/goal';
import { QUOTE_SOURCE } from '@/domain/quotes';
import { recurrenceLabel } from '@/domain/recurrence';
import { useQuote } from '@/hooks/useQuote';
import { useRoutineStore } from '@/store/useRoutineStore';
import { radius, useTheme } from '@/theme';

export default function RoutinesScreen() {
  const t = useTheme();
  const { routines, archiveRoutine, reorder } = useRoutineStore();
  const active = routines.filter((r) => !r.archivedAt);
  const quote = useQuote();

  const confirmArchive = (id: string, title: string) =>
    Alert.alert('Archive routine?', `"${title}" will stop appearing from today. Past history is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => archiveRoutine(id).catch(onFail()) },
    ]);

  const menu = (id: string, title: string) =>
    Alert.alert(title, undefined, [
      { text: 'Edit', onPress: () => router.push({ pathname: '/routine-form', params: { id } }) },
      { text: 'Archive', style: 'destructive', onPress: () => confirmArchive(id, title) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.text }]}>Routines</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.push('/ai-settings' as Href)} hitSlop={12} accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={24} color={t.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/backup' as Href)} hitSlop={12} accessibilityLabel="Cloud backup">
            <Ionicons name="cloud-upload-outline" size={24} color={t.text} />
          </Pressable>
        </View>
      </View>
      {quote && (
        <View style={[styles.quote, { backgroundColor: t.accentSoft }]} accessibilityLabel={`${quote.text} ${QUOTE_SOURCE}`}>
          <Text style={{ color: t.text, fontSize: 14, fontStyle: 'italic', lineHeight: 20 }}>“{quote.text}”</Text>
          <Text style={{ color: t.textDim, fontSize: 12, marginTop: 6 }}>— {QUOTE_SOURCE}</Text>
        </View>
      )}
      <ReorderableList
        data={active}
        contentContainerStyle={{ paddingBottom: 96 }} // clear of the floating button
        onReorder={(ids) => reorder(ids).catch(onFail())}
        empty={<Text style={{ color: t.textDim }}>No routines yet. Tap + to create your first one.</Text>}
        renderItem={(item, drag) => (
          <Pressable
            onPress={() => router.push({ pathname: '/routine-form', params: { id: item.id } })}
            onLongPress={drag.onLongPress}
            onPressOut={drag.onPressOut}
            delayLongPress={350}
            style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: t.text }]}>{item.title}</Text>
              <Text style={{ color: t.textDim, fontSize: 13, marginTop: 2 }}>
                {recurrenceLabel(item.recurrence)}
                {item.goal ? ' · Auto: ' + goalLabel(item.goal) : ''}
              </Text>
            </View>
            <Pressable onPress={() => menu(item.id, item.title)} hitSlop={12} accessibilityLabel={`More actions for ${item.title}`}>
              <Ionicons name="ellipsis-horizontal" size={22} color={t.textDim} />
            </Pressable>
          </Pressable>
        )}
      />
      <VersionInfo />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 34, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: radius.md, borderWidth: 1, marginBottom: 10 },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  quote: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
});
