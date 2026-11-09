import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notifyError } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { EMPTY_MEMORY, MEMORY_CATEGORIES } from '@/domain/memory';
import { useMemoryStore } from '@/store/useMemoryStore';
import { radius, useTheme } from '@/theme';

const TITLES: Record<(typeof MEMORY_CATEGORIES)[number], string> = {
  name: 'Name',
  tone: 'How you like replies',
  diet: 'Food & diet',
  fitness: 'Fitness & goals',
  schedule: 'Daily schedule',
  other: 'Other',
};

/** What Atomic remembers about you. Facts are sent with each request so replies fit you; delete any here. */
export default function MemoryScreen() {
  const t = useTheme();
  const memory = useMemoryStore((s) => s.memory);
  const fail = (e: unknown) => notifyError(e, 'Could not update memory');

  const confirmClear = () =>
    Alert.alert('Forget everything?', 'Atomic will no longer know anything about you and will ask its getting-to-know-you questions again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forget all', style: 'destructive', onPress: () => useMemoryStore.getState().replace(EMPTY_MEMORY).catch(fail) },
    ]);

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Text style={[styles.heading, { color: t.text }]}>Atomic memory</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>Close</Text>
        </Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={{ color: t.textDim, fontSize: 13, lineHeight: 18 }}>
          Atomic uses these to personalise its answers. They are sent to your AI provider with each request and included in your cloud backup. Just tell
          Atomic “remember …” or “forget …” any time.
        </Text>
        {memory.facts.length === 0 && (
          <Text style={{ color: t.textDim, marginTop: 24 }}>Nothing yet. Open Atomic and say hi, it will ask a few quick questions.</Text>
        )}
        {MEMORY_CATEGORIES.map((c) => {
          const facts = memory.facts.filter((f) => f.category === c);
          if (facts.length === 0) return null;
          return (
            <View key={c}>
              <Text style={[styles.label, { color: t.textDim }]}>{TITLES[c]}</Text>
              {facts.map((f) => (
                <View key={f.id} style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
                  <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>{f.text}</Text>
                  <Pressable
                    onPress={() => useMemoryStore.getState().forget(f.id).catch(fail)}
                    hitSlop={10}
                    accessibilityLabel={`Forget ${f.text}`}
                  >
                    <Ionicons name="close-circle" size={22} color={t.textDim} />
                  </Pressable>
                </View>
              ))}
            </View>
          );
        })}
        {memory.facts.length > 0 && (
          <Pressable onPress={confirmClear} style={styles.clear}>
            <Text style={{ color: t.danger, fontWeight: '600' }}>Forget everything</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heading: { fontSize: 24, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, marginBottom: 8 },
  clear: { alignItems: 'center', marginTop: 28, marginBottom: 12, padding: 12 },
});
