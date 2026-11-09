import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { onFail } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { VersionInfo } from '@/components/VersionInfo';
import { goalLabel } from '@/domain/goal';
import { useOneTimeHint } from '@/hooks/useOneTimeHint';
import { recurrenceLabel } from '@/domain/recurrence';
import { useRoutineStore } from '@/store/useRoutineStore';
import { radius, useTheme } from '@/theme';

export default function RoutinesScreen() {
  const t = useTheme();
  const { routines, archiveRoutine } = useRoutineStore();
  const active = routines.filter((r) => !r.archivedAt);
  const showHint = useOneTimeHint('archive-routine', active.length > 0);

  const confirmArchive = (id: string, title: string) =>
    Alert.alert('Archive routine?', `"${title}" will stop appearing from today. Past history is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => archiveRoutine(id).catch(onFail()) },
    ]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.text }]}>Routines</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.push('/ai-settings' as Href)}
            hitSlop={12}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={24} color={t.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/backup' as Href)}
            hitSlop={12}
            accessibilityLabel="Cloud backup"
          >
            <Ionicons name="cloud-upload-outline" size={24} color={t.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/routine-form')}
            style={[styles.add, { backgroundColor: t.accent }]}
            accessibilityLabel="Add routine"
          >
            <Ionicons name="add" size={26} color="#fff" />
          </Pressable>
        </View>
      </View>
      <FlatList
        data={active}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={{ color: t.textDim }}>Tap + to create your first routine.</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/routine-form', params: { id: item.id } })}
            onLongPress={() => confirmArchive(item.id, item.title)}
            style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: t.text }]}>{item.title}</Text>
              <Text style={{ color: t.textDim, fontSize: 13, marginTop: 2 }}>
                {recurrenceLabel(item.recurrence)}
                {item.goal ? ' · Auto: ' + goalLabel(item.goal) : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={t.textDim} />
          </Pressable>
        )}
      />
      {showHint && (
        <Text style={{ color: t.textDim, fontSize: 12, textAlign: 'center', paddingBottom: 12 }}>
          Long-press a routine to archive it
        </Text>
      )}
      <VersionInfo />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 34, fontWeight: '800' },
  add: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: radius.md, borderWidth: 1, marginBottom: 10 },
  rowTitle: { fontSize: 17, fontWeight: '600' },
});
