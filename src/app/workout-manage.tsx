import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { radius, useTheme } from '@/theme';

type Item = { icon: keyof typeof Ionicons.glyphMap; title: string; hint: string; href: Href };

const ITEMS: Item[] = [
  { icon: 'add-circle-outline', title: 'New template', hint: 'Plan a session you can repeat', href: '/template' as Href },
  { icon: 'list-outline', title: 'Exercises', hint: 'Browse the catalog or add your own', href: '/exercises' as Href },
  { icon: 'settings-outline', title: 'Settings', hint: 'Units, plates, warm-ups, Hevy import', href: '/workout-settings' as Href },
];

/** Everything that is set up once (templates, exercises, settings) so the Workouts tab can stay about repeating sessions. */
export default function WorkoutManage() {
  const t = useTheme();
  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.title, { color: t.text }]}>Manage workouts</Text>
      </View>
      {ITEMS.map((i) => (
        <Pressable
          key={i.title}
          onPress={() => router.push(i.href)}
          style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}
          accessibilityRole="button"
          accessibilityLabel={i.title}
        >
          <Ionicons name={i.icon} size={26} color={t.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: t.text }]}>{i.title}</Text>
            <Text style={{ color: t.textDim, fontSize: 13, marginTop: 2 }}>{i.hint}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={t.textDim} />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.md, borderWidth: 1, marginBottom: 10 },
  rowTitle: { fontSize: 17, fontWeight: '700' },
});
