import * as Haptics from 'expo-haptics';
import { useSegments } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, PanResponder, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ASSISTANT_VOICE_HINT } from '@/domain/assistant';
import { shouldAutoListen, TALKBACK_REARM_MS } from '@/domain/talkback';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { clearListenNext, initAssistant, openAssistant, reportError, stopAssistantSpeech, submit } from '@/services/assistantRunner';
import { useAssistantStore } from '@/store/useAssistantStore';
import { AtomicButton, type AtomicState } from './AtomicButton';
import { AtomicPanel } from './AtomicPanel';

const FAB = 52;
const MARGIN = 14;
const TAB_BAR = 49;
// Screens presented as native modals or camera views cover the app, so the button can't (and shouldn't) show there.
const HIDDEN_ON = new Set(['routine-form', 'scan', 'meal-builder', 'meal-target', 'ai-settings', 'backup', 'exercise-form', 'workout-settings', 'memory']);

type Voice = ReturnType<typeof useVoiceInput>;
// Single floating button for the whole app, so its gesture bookkeeping lives at module level.
const fab = { x: 0, y: 0, sx: 0, sy: 0, placed: false, width: 0, height: 0, top: 0, bottom: 0, voice: null as Voice | null };

/**
 * Atomic: a floating button on every screen plus its slide-up panel. Drag the button to move it; it snaps to the
 * nearest edge. Tapping it opens the panel and starts listening.
 */
export function AtomicHost() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const open = useAssistantStore((s) => s.open);
  const phase = useAssistantStore((s) => s.phase);
  const talkback = useAssistantStore((s) => s.talkback);
  const listenNext = useAssistantStore((s) => s.listenNext);

  const voice = useVoiceInput(
    (t) => submit(t),
    (e) => reportError(e, 'I could not hear that. Please try again.'),
    ASSISTANT_VOICE_HINT,
    { autoStop: true },
  );
  const startX = fab.placed ? fab.x : width - FAB - MARGIN;
  const startY = fab.placed ? fab.y : height - insets.bottom - TAB_BAR - FAB - MARGIN - 8;
  useEffect(() => {
    if (!fab.placed) {
      fab.placed = true;
      fab.x = startX;
      fab.y = startY;
    }
    fab.width = width;
    fab.height = height;
    fab.top = insets.top;
    fab.bottom = insets.bottom;
    fab.voice = voice;
  });
  const [pan] = useState(() => new Animated.ValueXY({ x: startX, y: startY }));

  useEffect(() => {
    initAssistant().catch(() => {});
  }, []);

  // Closing the panel drops any take in progress.
  useEffect(() => {
    if (!open) fab.voice?.cancel();
  }, [open]);

  const openPanel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    openAssistant();
    // Open the mic in the same tick: the sheet shows "Listening" from its first frame (voice state is 'starting').
    fab.voice?.toggle();
  }, []);

  // Talkback: after a reply has been spoken, reopen the mic by itself.
  useEffect(() => {
    const input = { open, talkback, listenNext, phase, voice: voice.state };
    if (!shouldAutoListen(input)) return;
    const id = setTimeout(() => {
      const s = useAssistantStore.getState();
      clearListenNext();
      if (shouldAutoListen({ ...s, voice: fab.voice?.state ?? 'idle' })) fab.voice?.toggle();
    }, TALKBACK_REARM_MS);
    return () => clearTimeout(id);
  }, [open, talkback, listenNext, phase, voice.state]);

  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        fab.sx = fab.x;
        fab.sy = fab.y;
      },
      onPanResponderMove: (_, g) => {
        pan.setValue({ x: fab.sx + g.dx, y: fab.sy + g.dy });
      },
      onPanResponderRelease: (_, g) => {
        if (Math.hypot(g.dx, g.dy) < 6) {
          pan.setValue({ x: fab.x, y: fab.y });
          openPanel();
          return;
        }
        const rawX = fab.sx + g.dx;
        const rawY = fab.sy + g.dy;
        fab.x = rawX + FAB / 2 < fab.width / 2 ? MARGIN : fab.width - FAB - MARGIN;
        fab.y = Math.min(Math.max(rawY, fab.top + MARGIN), fab.height - fab.bottom - FAB - MARGIN);
        Animated.spring(pan, { toValue: { x: fab.x, y: fab.y }, useNativeDriver: false, friction: 7 }).start();
      },
      onPanResponderTerminate: () => pan.setValue({ x: fab.x, y: fab.y }),
    }),
  );

  const onMicPress = useCallback(() => {
    const v = fab.voice;
    if (!v) return;
    clearListenNext();
    if (v.state === 'recording') v.toggle();
    else if (v.state === 'idle' && useAssistantStore.getState().phase !== 'thinking') {
      stopAssistantSpeech(); // tapping while it talks interrupts and listens
      v.toggle();
    }
  }, []);

  const mode: AtomicState =
    voice.state === 'recording' || voice.state === 'starting'
      ? 'listening'
      : voice.state === 'transcribing' || phase === 'thinking'
        ? 'thinking'
        : phase === 'speaking'
          ? 'speaking'
          : 'idle';

  const hidden = HIDDEN_ON.has(segments[0] as string);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {!hidden && !open && (
        <Animated.View
          {...responder.panHandlers}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Open Atomic"
          onAccessibilityTap={openPanel}
          style={[styles.fab, { transform: pan.getTranslateTransform() }]}
        >
          <AtomicButton state="idle" size={FAB} mark="atom" />
        </Animated.View>
      )}
      <AtomicPanel state={mode} onMicPress={onMicPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', left: 0, top: 0, width: FAB, height: FAB },
});
