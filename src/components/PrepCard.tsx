import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '@/components/ProgressBar';
import { agendaFor, agendaProgress, itemDone, prepStreak } from '@/domain/prep';
import { usePrepEnabled } from '@/hooks/usePrepEnabled';
import { useToday } from '@/hooks/useToday';
import { usePrepStore } from '@/store/usePrepStore';
import { radius, useTheme } from '@/theme';

/** Compact entry on the Today screen; hidden outside the prep window. Opens the full checklist. */
export function PrepCard() {
  const t = useTheme();
  const enabled = usePrepEnabled();
  const today = useToday();
  const checked = usePrepStore((s) => s.checked);
  const agenda = useMemo(() => agendaFor(today, today, checked), [today, checked]);
  const progress = useMemo(() => agendaProgress(agenda, checked), [agenda, checked]);
  const streak = useMemo(() => prepStreak(today, checked), [today, checked]);
  if (!enabled || !agenda.day) return null;

  const rest = agenda.day.rest;
  const open = [...agenda.carried.map((c) => c.item), ...agenda.own].filter((it) => !itemDone(it, checked));
  const subtitle = rest
    ? agenda.day.focus
    : progress.complete
      ? "Today's goal complete"
      : `${open[0].title}${open.length > 1 ? ` +${open.length - 1} more` : ''}`;
  const tone = progress.complete ? t.success : t.accent;

  return (
    <Pressable
      onPress={() => router.push('/prep' as Href)}
      accessibilityRole="button"
      accessibilityLabel={`Switch prep, ${rest ? 'rest day' : `${progress.done} of ${progress.total} done`}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: progress.complete ? t.successSoft : t.surface,
          borderColor: progress.complete ? t.success : t.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: progress.complete ? t.successSoft : t.accentSoft }]}>
          <Ionicons name={progress.complete ? 'checkmark' : rest ? 'moon-outline' : 'rocket-outline'} size={20} color={tone} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: t.text }]}>Switch prep</Text>
            {!rest && (
              <Text style={[styles.count, { color: t.textDim }]}>
                {progress.done}/{progress.total}
              </Text>
            )}
            {streak > 1 && (
              <View style={styles.streak}>
                <Ionicons name="flame" size={13} color={t.accent} />
                <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>{streak}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.sub, { color: t.textDim }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.textDim} />
      </View>
      {!rest && <ProgressBar value={progress.fraction} height={6} color={tone} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: 14, gap: 12, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  count: { fontSize: 14, fontWeight: '600' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sub: { fontSize: 13, marginTop: 2 },
});
