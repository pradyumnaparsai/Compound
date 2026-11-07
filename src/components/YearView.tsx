import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MONTH_NAMES, monthGrid, todayKey } from '@/domain/date';
import { dayStatus } from '@/domain/recurrence';
import type { Routine } from '@/domain/types';
import { radius, useTheme } from '@/theme';

type Props = {
  year: number;
  routines: Routine[];
  done: Set<string>;
  onPickMonth: (month: number) => void;
};

function YearViewImpl({ year, routines, done, onPickMonth }: Props) {
  const t = useTheme();
  const today = todayKey();

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) => ({
        m,
        rows: monthGrid(year, m).map((row) =>
          row.map((key) => (key ? { key, status: dayStatus(routines, done, key) } : null)),
        ),
      })),
    [year, routines, done],
  );

  return (
    <View style={styles.grid}>
      {months.map(({ m, rows }) => (
        <Pressable
          key={m}
          onPress={() => onPickMonth(m)}
          style={[styles.month, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <Text style={[styles.name, { color: t.text }]}>{MONTH_NAMES[m].slice(0, 3)}</Text>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((cell, ci) => (
                <View key={ci} style={styles.cellBox}>
                  {cell && (
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            cell.status === 'all'
                              ? t.success
                              : cell.status === 'partial'
                                ? t.successSoft
                                : cell.status === 'none'
                                  ? t.surfaceAlt
                                  : 'transparent',
                          borderColor: cell.key === today ? t.accent : 'transparent',
                          borderWidth: cell.key === today ? 1.5 : 0,
                        },
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>
          ))}
        </Pressable>
      ))}
    </View>
  );
}

export const YearView = memo(YearViewImpl);

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  month: { width: '31.7%', borderRadius: radius.md, borderWidth: 1, padding: 8 },
  name: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row' },
  cellBox: { width: `${100 / 7}%`, aspectRatio: 1, padding: 1 },
  dot: { flex: 1, borderRadius: 3 },
});
