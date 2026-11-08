import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cancelPending, cancelRequest, closeAssistant, confirmPending, toggleMute, undoLast } from '@/services/assistantRunner';
import { useAssistantStore } from '@/store/useAssistantStore';
import { radius, space, useTheme } from '@/theme';
import { AtomicButton, type AtomicState } from './AtomicButton';

type Props = { state: AtomicState; onMicPress: () => void };

const CAPTION: Record<AtomicState, string> = {
  idle: 'Tap to speak',
  listening: 'Stops when you pause, or tap to send',
  thinking: 'Tap to cancel',
  speaking: 'Tap to interrupt',
};

/** Atomic's sheet: the latest thing it heard, its answer, and one button. No chat history, no typing. */
export function AtomicPanel({ state, onMicPress }: Props) {
  const t = useTheme();
  const open = useAssistantStore((s) => s.open);
  const exchange = useAssistantStore((s) => s.exchange);
  const pending = useAssistantStore((s) => s.pending);
  const undo = useAssistantStore((s) => s.undo);
  const muted = useAssistantStore((s) => s.muted);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  const [slide] = useState(() => new Animated.Value(0));

  // Mount the sheet as soon as it is asked for; it unmounts after the slide-out finishes.
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) {
      Animated.timing(slide, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(slide, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
        ({ finished }) => finished && setMounted(false),
      );
    }
  }, [open, slide]);

  if (!mounted) return null;

  const headline =
    exchange?.reply ??
    (state === 'listening' ? 'Listening…' : state === 'thinking' ? (exchange?.heard ? 'On it…' : 'One moment…') : 'What do you need?');
  const sheetY = slide.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
  const onPress = state === 'thinking' ? cancelRequest : onMicPress;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeAssistant} accessibilityLabel="Close Atomic" />
      </Animated.View>

      <View style={styles.bottom} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: t.surface,
              borderColor: t.border,
              paddingBottom: Math.max(insets.bottom, space.lg) + space.sm,
              transform: [{ translateY: sheetY }],
            },
          ]}
        >
          <View style={styles.header}>
            <MaterialCommunityIcons name="atom" size={20} color={t.accent} />
            <Text style={[styles.title, { color: t.text }]}>Atomic</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={toggleMute} hitSlop={10} accessibilityLabel={muted ? 'Turn voice replies on' : 'Turn voice replies off'}>
              <Ionicons name={muted ? 'volume-mute-outline' : 'volume-high-outline'} size={22} color={t.textDim} />
            </Pressable>
            <Pressable onPress={closeAssistant} hitSlop={10} accessibilityLabel="Close" style={{ marginLeft: space.lg }}>
              <Ionicons name="close" size={24} color={t.textDim} />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: height * 0.38 }}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {!!exchange?.heard && (
              <Text style={[styles.heard, { color: t.textDim }]} numberOfLines={3}>
                “{exchange.heard}”
              </Text>
            )}
            <Text style={[styles.headline, { color: exchange?.error ? t.danger : t.text }]}>{headline}</Text>
            {!exchange && state === 'idle' && (
              <Text style={[styles.hint, { color: t.textDim }]}>
                Try “add a task to buy milk tomorrow” or “log two rotis and dal for lunch”.
              </Text>
            )}
            {exchange?.chips.map((c) => (
              <View key={c.id} style={styles.chip}>
                <Ionicons name={c.ok ? 'checkmark-circle' : 'alert-circle'} size={17} color={c.ok ? t.success : t.danger} />
                <Text style={[styles.chipText, { color: t.text }]}>{c.text}</Text>
              </View>
            ))}
          </ScrollView>

          {pending && (
            <View style={[styles.confirm, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
              {pending.labels.map((l) => (
                <Text key={l} style={[styles.confirmLine, { color: t.text }]}>
                  {l}
                </Text>
              ))}
              <View style={styles.confirmRow}>
                <Pressable style={[styles.btn, { backgroundColor: t.accent }]} onPress={confirmPending}>
                  <Text style={styles.btnText}>Confirm</Text>
                </Pressable>
                <Pressable style={[styles.btn, { backgroundColor: t.surface, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth }]} onPress={cancelPending}>
                  <Text style={[styles.btnText, { color: t.text }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}

          {undo && !pending && (
            <Pressable style={[styles.undo, { borderColor: t.border }]} onPress={undoLast}>
              <Ionicons name="arrow-undo" size={14} color={t.accent} />
              <Text style={[styles.undoText, { color: t.accent }]}>Undo{undo.count > 1 ? ` ${undo.count} changes` : ''}</Text>
            </Pressable>
          )}

          <Pressable
            onPress={onPress}
            style={styles.mic}
            accessibilityRole="button"
            accessibilityLabel={CAPTION[state]}
          >
            <AtomicButton state={state} size={68} />
          </Pressable>
          <Text style={[styles.caption, { color: t.textDim }]}>{CAPTION[state]}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  body: { paddingTop: space.xl, paddingBottom: space.md, gap: space.sm },
  heard: { fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  headline: { fontSize: 24, fontWeight: '800', lineHeight: 31 },
  hint: { fontSize: 14, lineHeight: 20, marginTop: space.xs },
  chip: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: space.xs },
  chipText: { flex: 1, fontSize: 15, lineHeight: 21 },
  confirm: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md, marginTop: space.sm, gap: space.xs },
  confirmLine: { fontSize: 15, fontWeight: '600' },
  confirmRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  btn: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.sm },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingVertical: space.sm - 1,
    paddingHorizontal: space.md + 2,
    marginTop: space.sm,
  },
  undoText: { fontWeight: '700', fontSize: 13 },
  mic: { alignSelf: 'center', marginTop: space.xl, padding: space.sm },
  caption: { alignSelf: 'center', fontSize: 13, marginTop: space.xs },
});
