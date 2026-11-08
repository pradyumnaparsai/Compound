import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { radius, useTheme } from '@/theme';

type ChipProps = { label: string; on?: boolean; dashed?: boolean; onPress: () => void; onLongPress?: () => void };

/** Fixed-height pill. */
export function Chip({ label, on = false, dashed = false, onPress, onLongPress }: ChipProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[
        styles.chip,
        { backgroundColor: on ? t.accent : t.surface, borderColor: on ? t.accent : t.border },
        dashed && { borderStyle: 'dashed', backgroundColor: 'transparent' },
      ]}
    >
      <Text style={{ color: on ? '#fff' : dashed ? t.textDim : t.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Horizontal row of chips. A bare horizontal ScrollView inside a column grows (or gets squeezed by its
 * siblings) and the pills stretch or clip, so the row is pinned to its content height.
 */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.row}
      contentContainerStyle={styles.content}
    >
      {children}
    </ScrollView>
  );
}

const CHIP_H = 34;
const styles = StyleSheet.create({
  row: { flexGrow: 0, flexShrink: 0, height: CHIP_H + 4, marginBottom: 8 },
  content: { gap: 8, alignItems: 'center', paddingVertical: 2, paddingRight: 8 },
  chip: { height: CHIP_H, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
