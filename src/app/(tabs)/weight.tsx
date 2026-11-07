import { useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { notifyError, onFail } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { WeeklyChart } from '@/components/WeeklyChart';
import { MONTH_NAMES, fromKey, todayKey } from '@/domain/date';
import { weeklyAverages } from '@/domain/weight';
import { useWeightStore } from '@/store/useWeightStore';
import { radius, useTheme } from '@/theme';

export default function WeightScreen() {
  const t = useTheme();
  const { entries, log, remove } = useWeightStore();
  const today = todayKey();
  const todayEntry = entries.find((e) => e.date === today);
  const [text, setText] = useState('');

  const weeks = useMemo(() => weeklyAverages(entries, today, 12), [entries, today]);
  const latest = entries[entries.length - 1];
  const change =
    weeks.length >= 2 ? weeks[weeks.length - 1].avg - weeks[weeks.length - 2].avg : null;

  const parsed = Number(text.replace(',', '.'));
  const valid = text.trim() !== '' && Number.isFinite(parsed) && parsed >= 20 && parsed <= 400;

  const save = async () => {
    try {
      await log(today, Math.round(parsed * 10) / 10);
      setText('');
      Keyboard.dismiss();
    } catch (e) {
      notifyError(e, 'Could not save', 'Could not save your weight. Please try again.');
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={[styles.title, { color: t.text }]}>Weight</Text>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={{ color: t.textDim, fontSize: 13 }}>
            {todayEntry ? `Today: ${todayEntry.kg.toFixed(1)} kg — enter a new value to update` : 'Log today’s weight'}
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              placeholder={latest ? latest.kg.toFixed(1) : '70.0'}
              placeholderTextColor={t.textDim}
              style={[styles.input, { backgroundColor: t.surfaceAlt, color: t.text }]}
              returnKeyType="done"
              onSubmitEditing={() => valid && save()}
            />
            <Text style={{ color: t.textDim, fontSize: 16, fontWeight: '600' }}>kg</Text>
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
                {change.toFixed(1)} kg vs last week
              </Text>
            )}
          </View>
          {weeks.length === 0 ? (
            <Text style={{ color: t.textDim, marginTop: 8 }}>Log a few days to see your trend.</Text>
          ) : (
            <WeeklyChart data={weeks} />
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
                Alert.alert('Delete entry?', `${e.kg.toFixed(1)} kg on ${e.date}`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => remove(e.date).catch(onFail()) },
                ])
              }
              style={[styles.hist, { backgroundColor: t.surface, borderColor: t.border }]}
            >
              <Text style={{ color: t.text, fontSize: 16 }}>
                {MONTH_NAMES[d.getMonth()].slice(0, 3)} {d.getDate()}
              </Text>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{e.kg.toFixed(1)} kg</Text>
            </Pressable>
          );
        })}
        {entries.length > 0 && (
          <Text style={{ color: t.textDim, fontSize: 12, textAlign: 'center', marginTop: 6 }}>
            Long-press an entry to delete it
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 34, fontWeight: '800', marginBottom: 16 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16, marginBottom: 16, gap: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h2: { fontSize: 18, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, borderRadius: radius.md, padding: 14, fontSize: 22, fontWeight: '700' },
  btn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.md },
  hist: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderRadius: radius.md, borderWidth: 1, marginBottom: 8 },
});
