import { StyleSheet, Text, View } from 'react-native';
import { formatWeekLabel, type WeeklyAverage } from '@/domain/weight';
import { useTheme } from '@/theme';

const CHART_H = 140;

/** Dependency-free bar chart (no native lib needed). Bars are scaled to a padded min–max range. */
export function WeeklyChart({ data }: { data: WeeklyAverage[] }) {
  const t = useTheme();
  if (data.length === 0) return null;
  const vals = data.map((d) => d.avg);
  const pad = Math.max(0.5, (Math.max(...vals) - Math.min(...vals)) * 0.3);
  const lo = Math.min(...vals) - pad;
  const hi = Math.max(...vals) + pad;

  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {data.map((d, i) => {
          const h = Math.max(8, ((d.avg - lo) / (hi - lo)) * CHART_H);
          const last = i === data.length - 1;
          return (
            <View key={d.weekStart} style={styles.col}>
              <Text style={[styles.val, { color: last ? t.text : t.textDim }]}>{d.avg.toFixed(1)}</Text>
              <View style={[styles.bar, { height: h, backgroundColor: last ? t.accent : t.accentSoft }]} />
              <Text style={[styles.lbl, { color: t.textDim }]}>{formatWeekLabel(d.weekStart)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: CHART_H + 44 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6 },
  val: { fontSize: 9, fontWeight: '600', marginBottom: 4 },
  lbl: { fontSize: 9, marginTop: 4 },
});
