import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, useTheme } from '@/theme';

type Props = {
  message: string;
  /** 'error' = something failed (calm amber card); 'info' = guidance, not a failure. */
  tone?: 'error' | 'info';
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
};

/** One short sentence in a soft card — replaces raw red error text. */
export function InlineNotice({ message, tone = 'error', actionLabel, onAction, onDismiss }: Props) {
  const t = useTheme();
  const warn = t.dark ? '#F5B84B' : '#B7791F';
  const color = tone === 'error' ? warn : t.accent;
  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: tone === 'error' ? `${warn}22` : t.accentSoft }]}
    >
      <Ionicons name={tone === 'error' ? 'alert-circle-outline' : 'information-circle-outline'} size={18} color={color} />
      <Text style={[styles.text, { color: t.text }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={{ color, fontWeight: '700', fontSize: 13 }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={16} color={t.textDim} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 },
  text: { flex: 1, fontSize: 13, lineHeight: 18 },
});
