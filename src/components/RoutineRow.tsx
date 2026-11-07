import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressRing } from '@/components/ProgressRing';
import { goalProgress, stepFraction } from '@/domain/goal';
import { recurrenceLabel } from '@/domain/recurrence';
import { useHealthStore } from '@/store/useHealthStore';
import { useMealStore } from '@/store/useMealStore';
import type { Routine } from '@/domain/types';
import { radius, useTheme } from '@/theme';

type Props = {
  routine: Routine;
  date: string; // day this row represents (for health progress)
  done: boolean;
  disabled?: boolean;
  onToggle: () => void;
  /** Long-press / release handlers from a ReorderableList. */
  dragProps?: { onLongPress: () => void; onPressOut: () => void };
};

export function RoutineRow({ routine, date, done, disabled, onToggle, dragProps }: Props) {
  const t = useTheme();
  const goal = routine.goal;
  const { steps, workouts, checked } = useHealthStore();
  const protein = useMealStore((s) => s.meals.reduce((a, m) => (m.date === date ? a + m.proteinG : a), 0));
  return (
    <Pressable
      disabled={disabled}
      onLongPress={dragProps?.onLongPress}
      onPressOut={dragProps?.onPressOut}
      delayLongPress={350}
      onPress={() => {
        if (goal) return; // health/meal-goal routines complete automatically
        Haptics.impactAsync(
          done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
        ).catch(() => {});
        onToggle();
      }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: done ? t.successSoft : t.surface,
          borderColor: done ? t.success : t.border,
          opacity: pressed ? 0.85 : disabled && !goal ? 0.5 : 1,
        },
      ]}
    >
      {goal?.type === 'steps' ? (
        <ProgressRing value={done ? 1 : checked ? stepFraction(goal, steps[date]) : 0} size={40} stroke={4}>
          <Ionicons
            name={done ? 'checkmark' : 'footsteps'}
            size={done ? 22 : 16}
            color={done ? t.success : t.textDim}
          />
        </ProgressRing>
      ) : (
        <View
          style={[
            styles.check,
            { borderColor: done ? t.success : t.textDim, backgroundColor: done ? t.success : 'transparent' },
          ]}
        >
          {done && <Ionicons name="checkmark" size={18} color={t.bg} />}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.title,
            { color: t.text, textDecorationLine: done ? 'line-through' : 'none', opacity: done ? 0.7 : 1 },
          ]}
          numberOfLines={2}
        >
          {routine.title}
        </Text>
        <Text style={[styles.sub, { color: t.textDim }]}>
          {recurrenceLabel(routine.recurrence)}
          {goal ? ' · ' + goalProgress(goal, steps[date], workouts[date], checked, protein) : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 10,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '600' },
  sub: { fontSize: 13, marginTop: 2 },
});
