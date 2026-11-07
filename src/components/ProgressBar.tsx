import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const t = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: t.surfaceAlt, height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: color ?? t.success, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
  fill: { height: '100%' },
});
