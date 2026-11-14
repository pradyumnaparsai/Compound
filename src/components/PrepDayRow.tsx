import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { agendaFor, agendaProgress } from '@/domain/prep';
import { usePrepEnabled } from '@/hooks/usePrepEnabled';
import { useToday } from '@/hooks/useToday';
import { usePrepStore } from '@/store/usePrepStore';
import { radius, useTheme } from '@/theme';

/** Calendar entry for one date: what switch prep planned that day and how much is done. Opens that day. */
export function PrepDayRow({ date }: { date: string }) {
  const t = useTheme();
  const enabled = usePrepEnabled();
  const today = useToday();
  const checked = usePrepStore((s) => s.checked);
  const agenda = useMemo(() => agendaFor(date, today, checked), [date, today, checked]);
  const progress = useMemo(() => agendaProgress(agenda, checked), [agenda, checked]);
  if (!enabled || !agenda.day) return null;

  const rest = agenda.day.rest;
  const tone = progress.complete ? t.success : t.accent;
  return (
    <Pressable
      onPress={() => router.push(`/prep?date=${date}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`Switch prep, ${agenda.day.focus}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: progress.complete ? t.successSoft : t.surface,
          borderColor: progress.complete ? t.success : t.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name={progress.complete ? 'checkmark-circle' : rest ? 'moon-outline' : 'rocket-outline'} size={22} color={tone} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Switch prep</Text>
        <Text style={{ color: t.textDim, fontSize: 12 }} numberOfLines={1}>
          {agenda.day.focus}
        </Text>
      </View>
      {!rest && (
        <Text style={{ color: tone, fontWeight: '700', fontSize: 14 }}>
          {progress.done}/{progress.total}
        </Text>
      )}
      <Ionicons name="chevron-forward" size={18} color={t.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, marginBottom: 12 },
});
