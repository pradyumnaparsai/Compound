import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';

export type ChartPoint = { key: string; label: string; value: number; valueLabel: string };
const CHART_H = 120;

/** Dependency-free bar chart for one exercise's progress; bars scale from just under the minimum to the maximum. */
export function ProgressChart({ data }: { data: ChartPoint[] }) {
  const t = useTheme();
  if (data.length === 0) return null;
  const vals = data.map((d) => d.value);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const lo = data.length === 1 ? 0 : Math.max(0, min - (max - min) * 0.4 - max * 0.02);
  const span = max - lo || 1;
  const dense = data.length > 8;
  return (
    <View style={styles.bars}>
      {data.map((d, i) => {
        const last = i === data.length - 1;
        const h = Math.max(6, ((d.value - lo) / span) * CHART_H);
        return (
          <View key={d.key} style={styles.col}>
            {(!dense || last) && (
              <Text style={[styles.val, { color: last ? t.text : t.textDim }]} numberOfLines={1}>
                {d.valueLabel}
              </Text>
            )}
            <View style={[styles.bar, { height: h, backgroundColor: last ? t.accent : t.accentSoft }]} />
            {(!dense || i % 3 === 0 || last) && (
              <Text style={[styles.lbl, { color: t.textDim }]} numberOfLines={1}>
                {d.label}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: CHART_H + 44 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6 },
  val: { fontSize: 9, fontWeight: '700', marginBottom: 4 },
  lbl: { fontSize: 9, marginTop: 4 },
});
