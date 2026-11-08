import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, useTheme } from '@/theme';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
};

/** Compact pill switcher (used by the Body tab: Workouts | Weight). */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: t.surfaceAlt }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.item, on && { backgroundColor: t.accent }]}
          >
            <Text style={{ color: on ? '#fff' : t.textDim, fontWeight: '700', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: radius.pill, padding: 3, marginBottom: 14 },
  item: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill },
});
