import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cancelPending,
  clearConversation,
  closeAssistant,
  confirmPending,
  submit,
  toggleMute,
  undoLast,
} from '@/services/assistantRunner';
import { speechAvailable } from '@/services/speak';
import { useAssistantStore, type Msg } from '@/store/useAssistantStore';
import { AssistantOrb } from './AssistantOrb';
import { hud, statusLabel, type OrbMode } from './palette';

type Props = { mode: OrbMode; onOrbPress: () => void };

const SUGGESTIONS = [
  'Add a task: buy milk tomorrow',
  'Log lunch: two rotis and dal',
  'New routine: gym on Monday, Wednesday, Friday',
  'How many calories do I have left today?',
];

export function AssistantPanel({ mode, onOrbPress }: Props) {
  const open = useAssistantStore((s) => s.open);
  const messages = useAssistantStore((s) => s.messages);
  const pending = useAssistantStore((s) => s.pending);
  const undo = useAssistantStore((s) => s.undo);
  const muted = useAssistantStore((s) => s.muted);
  const busy = useAssistantStore((s) => s.phase === 'thinking');
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState('');
  const [slide] = useState(() => new Animated.Value(0));
  const scroll = useRef<ScrollViewInstance>(null);

  // Mount the sheet as soon as it is asked for; it unmounts after the slide-out finishes.
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) {
      Animated.timing(slide, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(slide, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
        ({ finished }) => finished && setMounted(false),
      );
    }
  }, [open, slide]);

  if (!mounted) return null;

  const sheetH = Math.min(height * 0.82, 720);
  const send = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    submit(t);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,3,10,0.62)', opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeAssistant} accessibilityLabel="Close assistant" />
      </Animated.View>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetH,
              maxHeight: height - insets.top - 8,
              flexShrink: 1,
              paddingBottom: Math.max(insets.bottom, 12),
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [sheetH, 0] }) }],
            },
          ]}
        >
          <View style={styles.glowLine} />
          <View style={styles.header}>
            <AssistantOrb mode={mode} size={34} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>Compound AI</Text>
              <Text style={styles.sub}>{statusLabel[mode]}</Text>
            </View>
            {speechAvailable() && (
              <IconBtn
                name={muted ? 'volume-mute' : 'volume-high'}
                label={muted ? 'Unmute voice replies' : 'Mute voice replies'}
                onPress={toggleMute}
              />
            )}
            {messages.length > 0 && <IconBtn name="trash-outline" label="Clear conversation" onPress={clearConversation} />}
            <IconBtn name="close" label="Close" onPress={closeAssistant} />
          </View>

          <ScrollView
            ref={scroll}
            style={{ flex: 1 }}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View>
                <Text style={styles.hello}>What should I do?</Text>
                <Text style={styles.helloSub}>Routines, tasks, meals, weight and goals. Just say it.</Text>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} style={styles.suggestion} onPress={() => submit(s)} disabled={busy}>
                    <Ionicons name="sparkles-outline" size={14} color={hud.cyan} />
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              messages.map((m) => <Bubble key={m.id} m={m} />)
            )}
            {busy && (
              <Text style={styles.working}>Working on it…</Text>
            )}
          </ScrollView>

          {pending && (
            <View style={styles.confirm}>
              <Text style={styles.confirmTitle}>Confirm?</Text>
              {pending.labels.map((l) => (
                <Text key={l} style={styles.confirmLine}>
                  • {l}
                </Text>
              ))}
              <View style={styles.confirmRow}>
                <Pressable style={[styles.btn, { backgroundColor: hud.violet }]} onPress={confirmPending}>
                  <Text style={styles.btnText}>Confirm</Text>
                </Pressable>
                <Pressable style={[styles.btn, { backgroundColor: hud.cardStrong }]} onPress={cancelPending}>
                  <Text style={styles.btnText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}

          {undo && !pending && (
            <Pressable style={styles.undo} onPress={undoLast}>
              <Ionicons name="arrow-undo" size={14} color={hud.cyan} />
              <Text style={styles.undoText}>Undo {undo.count > 1 ? `${undo.count} changes` : 'last change'}</Text>
            </Pressable>
          )}

          <Pressable
            onPress={onOrbPress}
            disabled={busy}
            style={styles.orbWrap}
            accessibilityRole="button"
            accessibilityLabel={mode === 'listening' ? 'Stop and send' : 'Speak to the assistant'}
          >
            <AssistantOrb mode={mode} size={76} />
          </Pressable>

          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Or type a command…"
              placeholderTextColor={hud.dim}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={send}
              editable={!busy}
            />
            <Pressable
              onPress={send}
              disabled={!text.trim() || busy}
              style={[styles.send, { opacity: text.trim() && !busy ? 1 : 0.35 }]}
              accessibilityLabel="Send"
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function IconBtn({ name, label, onPress }: { name: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} style={styles.iconBtn}>
      <Ionicons name={name} size={20} color={hud.dim} />
    </Pressable>
  );
}

function Bubble({ m }: { m: Msg }) {
  if (m.role === 'user') {
    return (
      <View style={[styles.bubble, styles.user]}>
        <Text style={styles.userText}>{m.text}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.bubble, styles.ai, m.error && { borderLeftColor: hud.danger }]}>
      <Text style={styles.aiText}>{m.text}</Text>
      {m.chips?.map((c) => (
        <View key={c.id} style={styles.chip}>
          <Ionicons name={c.ok ? 'checkmark-circle' : 'alert-circle'} size={15} color={c.ok ? hud.ok : hud.danger} />
          <Text style={styles.chipText}>{c.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: hud.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: 'rgba(124,92,255,0.5)',
    paddingHorizontal: 16,
    shadowColor: hud.violet,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
  },
  glowLine: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  title: { color: hud.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  sub: { color: hud.cyan, fontSize: 12, marginTop: 2, fontWeight: '600' },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  messages: { paddingBottom: 8, gap: 10 },
  hello: { color: hud.text, fontSize: 22, fontWeight: '800', marginTop: 8 },
  helloSub: { color: hud.dim, fontSize: 14, marginTop: 4, marginBottom: 14 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: hud.card,
    borderColor: hud.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  suggestionText: { color: hud.text, fontSize: 14, flex: 1 },
  bubble: { maxWidth: '88%', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  user: { alignSelf: 'flex-end', backgroundColor: 'rgba(124,92,255,0.30)', borderBottomRightRadius: 6 },
  userText: { color: hud.text, fontSize: 15 },
  ai: {
    alignSelf: 'flex-start',
    backgroundColor: hud.card,
    borderColor: hud.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderLeftColor: hud.cyan,
    borderBottomLeftRadius: 6,
  },
  aiText: { color: hud.text, fontSize: 15, lineHeight: 21 },
  chip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  chipText: { color: hud.dim, fontSize: 13, flex: 1, lineHeight: 18 },
  working: { color: hud.dim, fontSize: 13, alignSelf: 'flex-start', marginLeft: 4 },
  confirm: {
    backgroundColor: 'rgba(255,92,200,0.10)',
    borderColor: 'rgba(255,92,200,0.45)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  confirmTitle: { color: hud.pink, fontWeight: '800', marginBottom: 4 },
  confirmLine: { color: hud.text, fontSize: 14, marginBottom: 2 },
  confirmRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.45)',
    marginBottom: 6,
  },
  undoText: { color: hud.cyan, fontWeight: '700', fontSize: 13 },
  orbWrap: { alignSelf: 'center', marginVertical: 14, padding: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    color: hud.text,
    backgroundColor: hud.card,
    borderColor: hud.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 15,
  },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: hud.violet, alignItems: 'center', justifyContent: 'center' },
});
