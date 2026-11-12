import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { makeParticles, type Particle } from '@/domain/celebrate';
import { useDayGoalCelebration } from '@/hooks/useDayGoalCelebration';
import { useCelebration, type BurstKind } from '@/store/useCelebration';

const COLORS = ['#FF5A5F', '#FFB400', '#2EC4B6', '#4C8DFF', '#B16CFF', '#7ED957'];
const SAMPLES = [0, 0.2, 0.4, 0.6, 0.8, 1];
const CONFIG: Record<BurstKind, { count: number; ms: number; spread: number }> = {
  small: { count: 16, ms: 1100, spread: 0.7 },
  big: { count: 56, ms: 2200, spread: 1 },
};

/** App-wide confetti overlay (touch-transparent) plus the "80% of the day done" watcher. Pure RN Animated. */
export function ConfettiHost() {
  useDayGoalCelebration();
  const burst = useCelebration((s) => s.burst);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  if (!burst || reduceMotion) return null;
  return <Burst key={burst.id} id={burst.id} kind={burst.kind} />;
}

function Burst({ id, kind }: { id: number; kind: BurstKind }) {
  const { width, height } = useWindowDimensions();
  const clear = useCelebration((s) => s.clear);
  const cfg = CONFIG[kind];
  const [particles] = useState(() => makeParticles(cfg.count));
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const a = Animated.timing(progress, { toValue: 1, duration: cfg.ms, easing: Easing.linear, useNativeDriver: true });
    a.start(({ finished }) => finished && clear(id));
    return () => a.stop();
  }, [progress, cfg.ms, clear, id]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      {particles.map((p, i) => (
        <Piece key={i} p={p} progress={progress} width={width} height={height} spread={cfg.spread} />
      ))}
    </View>
  );
}

function Piece({ p, progress, width, height, spread }: { p: Particle; progress: Animated.Value; width: number; height: number; spread: number }) {
  // Launch upwards from mid-screen, then gravity pulls it down: sampled so it can run on the native driver.
  const at = SAMPLES.map((s) => Math.max(0, (s - p.delay) / (1 - p.delay)));
  const x = at.map((q) => width * 0.5 + p.vx * spread * width * q);
  const y = at.map((q) => height * 0.55 + (p.vy * spread * q + 1.1 * q * q) * height * 0.6);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: p.size,
        height: p.size * 1.6,
        borderRadius: 2,
        backgroundColor: COLORS[p.color % COLORS.length],
        opacity: progress.interpolate({ inputRange: [0, p.delay, 0.75, 1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
        transform: [
          { translateX: progress.interpolate({ inputRange: SAMPLES, outputRange: x }) },
          { translateY: progress.interpolate({ inputRange: SAMPLES, outputRange: y }) },
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotate}deg`] }) },
        ],
      }}
    />
  );
}
