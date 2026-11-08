import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { remainingSeconds, restProgress } from '@/domain/restTimer';
import { formatDuration } from '@/domain/workout';
import { playRestDone } from '@/services/restAlert';
import { useRestTimer } from '@/store/useRestTimer';
import { radius, useTheme } from '@/theme';

/** Counts down to the stored end time (never a decrementing counter); chimes once at zero and hides itself. */
export function RestTimerBar() {
  const t = useTheme();
  const { endsAt, totalSeconds, adjust, stop } = useRestTimer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (remainingSeconds(endsAt, n) === 0) {
        playRestDone();
        stop();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, stop]);

  if (endsAt === null) return null;
  const left = remainingSeconds(endsAt, now);
  const progress = restProgress(endsAt, totalSeconds, now);

  return (
    <View style={[styles.bar, { backgroundColor: t.surface, borderColor: t.accent }]} accessibilityLiveRegion="polite">
      <View style={[styles.fill, { backgroundColor: t.accentSoft, width: `${progress * 100}%` }]} />
      <Ionicons name="timer-outline" size={20} color={t.accent} />
      <Text style={[styles.time, { color: t.text }]}>{formatDuration(left)}</Text>
      <View style={{ flex: 1 }} />
      <Pressable onPress={() => adjust(-15)} hitSlop={8} style={[styles.btn, { backgroundColor: t.surfaceAlt }]} accessibilityLabel="15 seconds less">
        <Text style={{ color: t.text, fontWeight: '700' }}>−15</Text>
      </Pressable>
      <Pressable onPress={() => adjust(15)} hitSlop={8} style={[styles.btn, { backgroundColor: t.surfaceAlt }]} accessibilityLabel="15 seconds more">
        <Text style={{ color: t.text, fontWeight: '700' }}>+15</Text>
      </Pressable>
      <Pressable onPress={stop} hitSlop={8} style={[styles.btn, { backgroundColor: t.accent }]} accessibilityLabel="Skip rest">
        <Text style={{ color: '#fff', fontWeight: '800' }}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  time: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
});
