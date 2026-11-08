import { useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { notifyError, onFail } from '@/components/notify';
import { WeeklyChart } from '@/components/WeeklyChart';
import { useOneTimeHint } from '@/hooks/useOneTimeHint';
import { MONTH_NAMES, fromKey, todayKey } from '@/domain/date';
import { formatNumber, formatWeight, kgToUnit, parseWeightInput } from '@/domain/units';
import { weeklyAverages } from '@/domain/weight';
import { useUnitStore } from '@/store/useUnitStore';
import { useWeightStore } from '@/store/useWeightStore';
import { radius, useTheme } from '@/theme';

/** Body-weight log and weekly average chart. Stored in kg, shown in the chosen unit. */
export function WeightPanel() {
  const t = useTheme();
  const unit = useUnitStore((s) => s.unit);
  const { entries, log, remove } = useWeightStore();
  const today = todayKey();
  const todayEntry = entries.find((e) => e.date === today);
  const [text, setText] = useState('');
  const showHint = useOneTimeHint('delete-entry', entries.length > 0);

  const weeks = useMemo(() => weeklyAverages(entries, today, 12), [entries, today]);
  const chartData = useMemo(() => weeks.map((w) => ({ ...w, avg: kgToUnit(w.avg, unit) })), [weeks, unit]);
  const latest = entries[entries.length - 1];
  const change =
    weeks.length >= 2 ? weeks[weeks.length - 1].avg - weeks[weeks.length - 2].avg : null;

  const parsedKg = parseWeightInput(text, unit);
  const valid = parsedKg !== null && parsedKg >= 20 && parsedKg <= 400;

  const save = async () => {
    try {
      // 0.1 kg is enough; lb entries keep 0.01 kg so a typed 135 lb still reads 135.
      await log(today, Math.round((parsedKg as number) * (unit === 'kg' ? 10 : 100)) / (unit === 'kg' ? 10 : 100));
      setText('');
      Keyboard.dismiss();
    } catch (e) {
      notifyError(e, 'Could not save', 'Could not save your weight. Please try again.');
    }
  };

  return (
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={{ color: t.textDim, fontSize: 13 }}>
            {todayEntry ? `Today: ${formatWeight(todayEntry.kg, unit)} — enter a new value to update` : 'Log today’s weight'}
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              placeholder={latest ? formatNumber(kgToUnit(latest.kg, unit)) : unit === 'kg' ? '70.0' : '155'}
              placeholderTextColor={t.textDim}
              style={[styles.input, { backgroundColor: t.surfaceAlt, color: t.text }]}
              returnKeyType="done"
              onSubmitEditing={() => valid && save()}
            />
            <Text style={{ color: t.textDim, fontSize: 16, fontWeight: '600' }}>{unit}</Text>
            <Pressable
              disabled={!valid}
              onPress={save}
              style={[styles.btn, { backgroundColor: t.accent, opacity: valid ? 1 : 0.4 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.cardHead}>
            <Text style={[styles.h2, { color: t.text }]}>Weekly average</Text>
            {change !== null && (
              <Text style={{ color: change <= 0 ? t.success : t.danger, fontWeight: '700' }}>
                {change > 0 ? '+' : ''}
                {formatNumber(kgToUnit(change, unit))} {unit} vs last week
              </Text>
            )}
          </View>
          {weeks.length === 0 ? (
            <Text style={{ color: t.textDim, marginTop: 8 }}>Log a few days to see your trend.</Text>
          ) : (
            <WeeklyChart data={chartData} />
          )}
          <Text style={{ color: t.textDim, fontSize: 11, marginTop: 8 }}>Weeks start Sunday · last 12 weeks</Text>
        </View>

        <Text style={[styles.h2, { color: t.text, marginTop: 8, marginBottom: 10 }]}>History</Text>
        {[...entries].reverse().slice(0, 30).map((e) => {
          const d = fromKey(e.date);
          return (
            <Pressable
              key={e.date}
              onLongPress={() =>
                Alert.alert('Delete entry?', `${formatWeight(e.kg, unit)} on ${e.date}`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => remove(e.date).catch(onFail()) },
                ])
              }
              style={[styles.hist, { backgroundColor: t.surface, borderColor: t.border }]}
            >
              <Text style={{ color: t.text, fontSize: 16 }}>
                {MONTH_NAMES[d.getMonth()].slice(0, 3)} {d.getDate()}
              </Text>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{formatWeight(e.kg, unit)}</Text>
            </Pressable>
          );
        })}
        {showHint && (
          <Text style={{ color: t.textDim, fontSize: 12, textAlign: 'center', marginTop: 6 }}>
            Long-press an entry to delete it
          </Text>
        )}
      </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16, marginBottom: 16, gap: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h2: { fontSize: 18, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, borderRadius: radius.md, padding: 14, fontSize: 22, fontWeight: '700' },
  btn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.md },
  hist: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderRadius: radius.md, borderWidth: 1, marginBottom: 8 },
});
