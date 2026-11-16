import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { formatNumber } from '@/domain/units';
import { formatWeekLabel, lineChartGeometry, xLabelIndices, type WeeklyAverage } from '@/domain/weight';
import { useTheme } from '@/theme';

const PLOT_H = 150;
const AXIS_W = 40; // y-axis labels
const PAD_X = 10; // keeps the first/last dot inside the plot
const LABEL_W = 44;
const DOT = 8;

/** Dependency-free line chart (Views only, no native lib): weekly averages on a shared x (week) / y (weight) axis. */
export function WeeklyChart({ data }: { data: WeeklyAverage[] }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  if (data.length === 0) return null;

  const plotW = Math.max(0, width - AXIS_W);
  const g = lineChartGeometry(data, Math.max(0, plotW - 2 * PAD_X), PLOT_H);
  const labelIdx = new Set(xLabelIndices(data.length));
  const showAllValues = data.length <= 7;
  const clampLeft = (x: number) => Math.min(Math.max(x - LABEL_W / 2, 0), Math.max(0, plotW - LABEL_W));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 && (
        <>
          <View style={{ height: PLOT_H + 12, flexDirection: 'row' }}>
            <View style={{ width: AXIS_W }}>
              {g.ticks.map((tk) => (
                <Text
                  key={tk.value}
                  style={[styles.tick, { color: t.textDim, top: tk.y + 6 - 7 }]}
                  numberOfLines={1}
                >
                  {formatNumber(tk.value)}
                </Text>
              ))}
            </View>
            <View style={{ width: plotW, height: PLOT_H + 12 }}>
              {g.ticks.map((tk) => (
                <View key={tk.value} style={[styles.grid, { top: tk.y + 6, backgroundColor: t.border }]} />
              ))}
              {g.segments.map((s, i) => (
                <View
                  key={i}
                  style={[
                    styles.seg,
                    {
                      left: PAD_X + s.cx - s.length / 2,
                      top: 6 + s.cy - 1.25,
                      width: s.length,
                      backgroundColor: t.accent,
                      transform: [{ rotate: `${s.angleDeg}deg` }],
                    },
                  ]}
                />
              ))}
              {g.points.map((p, i) => {
                const last = i === g.points.length - 1;
                return (
                  <View key={p.weekStart}>
                    <View
                      style={[
                        styles.dot,
                        {
                          left: PAD_X + p.x - DOT / 2,
                          top: 6 + p.y - DOT / 2,
                          backgroundColor: last ? t.accent : t.surface,
                          borderColor: t.accent,
                        },
                      ]}
                    />
                    {(showAllValues || last) && (
                      <Text
                        style={[
                          styles.val,
                          { left: clampLeft(PAD_X + p.x), top: Math.max(0, 6 + p.y - 24), color: last ? t.text : t.textDim },
                        ]}
                        numberOfLines={1}
                      >
                        {formatNumber(p.avg)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
          <View style={{ marginLeft: AXIS_W, width: plotW, height: 16 }}>
            {g.points.map(
              (p, i) =>
                labelIdx.has(i) && (
                  <Text key={p.weekStart} style={[styles.lbl, { left: clampLeft(PAD_X + p.x), color: t.textDim }]} numberOfLines={1}>
                    {formatWeekLabel(p.weekStart)}
                  </Text>
                ),
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, minHeight: PLOT_H + 32 },
  tick: { position: 'absolute', right: 6, fontSize: 10, fontWeight: '500' },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  seg: { position: 'absolute', height: 2.5, borderRadius: 2 },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2 },
  val: { position: 'absolute', width: LABEL_W, textAlign: 'center', fontSize: 10, fontWeight: '700' },
  lbl: { position: 'absolute', width: LABEL_W, textAlign: 'center', fontSize: 10, top: 2 },
});
