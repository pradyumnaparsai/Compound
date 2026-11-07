import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Task } from '@/domain/types';
import { radius, useTheme } from '@/theme';

type Props = {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  /** Shown for overdue tasks: pull it into today. */
  onMoveToToday?: () => void;
  /** e.g. "Nov 3" for overdue rows. */
  sub?: string;
};

export function TaskRow({ task, onToggle, onDelete, onMoveToToday, sub }: Props) {
  const t = useTheme();
  const done = !!task.completedAt;
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onToggle();
      }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: done ? t.successSoft : t.surface,
          borderColor: done ? t.success : t.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.check,
          { borderColor: done ? t.success : t.textDim, backgroundColor: done ? t.success : 'transparent' },
        ]}
      >
        {done && <Ionicons name="checkmark" size={16} color={t.bg} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.title, { color: t.text, textDecorationLine: done ? 'line-through' : 'none', opacity: done ? 0.7 : 1 }]}
          numberOfLines={3}
        >
          {task.title}
        </Text>
        {sub ? <Text style={[styles.sub, { color: t.textDim }]}>{sub}</Text> : null}
      </View>
      {onMoveToToday && !done && (
        <Pressable onPress={onMoveToToday} hitSlop={10} accessibilityLabel="Move to today">
          <Ionicons name="arrow-redo-outline" size={20} color={t.accent} />
        </Pressable>
      )}
      <Pressable onPress={onDelete} hitSlop={10} accessibilityLabel="Delete task">
        <Ionicons name="trash-outline" size={20} color={t.textDim} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
});
