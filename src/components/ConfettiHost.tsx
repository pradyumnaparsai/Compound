import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FIREWORK_BURST, FIREWORK_RISE, makeFireworks, makeParticles, makePop, type Particle, type Shell } from '@/domain/celebrate';
import { useDayGoalCelebration } from '@/hooks/useDayGoalCelebration';
import { useCelebration, type BurstKind, type Origin } from '@/store/useCelebration';
import { useTheme } from '@/theme';

const COLORS = ['#FF5A5F', '#FFB400', '#2EC4B6', '#4C8DFF', '#B16CFF', '#7ED957'];
const SAMPLES = [0, 0.2, 0.4, 0.6, 0.8, 1];
const CONFIG: Record<Exclude<BurstKind, 'fireworks'>, { count: number; ms: number; spread: number }> = {
  small: { count: 16, ms: 1100, spread: 0.7 },
  big: { count: 56, ms: 2200, spread: 1 },
};

/** App-wide celebration overlay (confetti, workout-complete fireworks) (touch-transparent) plus the "80% of the day done" watcher. Pure RN Animated. */
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
  if (burst.kind === 'fireworks') return <Fireworks key={burst.id} id={burst.id} />;
  if (burst.kind === 'small' && burst.origin) return <Pop key={burst.id} id={burst.id} origin={burst.origin} />;
  return <Burst key={burst.id} id={burst.id} kind={burst.kind} />;
}

const RING = 30;

/** A short radial pop around a point: ring pulse plus a handful of confetti flung outwards that settle and fade. */
function Pop({ id, origin }: { id: number; origin: Origin }) {
  const t = useTheme();
  const clear = useCelebration((s) => s.clear);
  const [particles] = useState(() => makePop(14));
  const [pos] = useState(() => new Animated.Value(0)); // eased: fast out, slow settle
  const [fade] = useState(() => new Animated.Value(0)); // linear

  useEffect(() => {
    const a = Animated.parallel([
      Animated.timing(pos, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 750, easing: Easing.linear, useNativeDriver: true }),
    ]);
    a.start(({ finished }) => finished && clear(id));
    return () => a.stop();
  }, [pos, fade, clear, id]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={{
          position: 'absolute',
          left: origin.x - RING / 2,
          top: origin.y - RING / 2,
          width: RING,
          height: RING,
          borderRadius: RING / 2,
          borderWidth: 2.5,
          borderColor: t.success,
          opacity: fade.interpolate({ inputRange: [0, 0.45], outputRange: [0.8, 0], extrapolate: 'clamp' }),
          transform: [{ scale: pos.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.4] }) }],
        }}
      />
      {particles.map((p, i) => {
        const dx = Math.cos(p.angle) * p.dist;
        const dy = Math.sin(p.angle) * p.dist;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: origin.x - p.size / 2,
              top: origin.y - p.size / 2,
              width: p.size,
              height: p.round ? p.size : p.size * 1.7,
              borderRadius: p.round ? p.size / 2 : 1.5,
              backgroundColor: COLORS[p.color % COLORS.length],
              opacity: fade.interpolate({ inputRange: [0, p.delay, 0.55, 1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
              transform: [
                { translateX: pos.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                // a touch of gravity: it drifts down as it settles
                { translateY: pos.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dy * 0.5 + 6, dy + 26] }) },
                { rotate: pos.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotate}deg`] }) },
                { scale: pos.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.3, 1.2, 0.9] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

function Burst({ id, kind }: { id: number; kind: Exclude<BurstKind, 'fireworks'> }) {
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

const SHOW_MS = 3600;
const SHELLS = 6;

/** Workout-complete fireworks: rockets climb from the bottom and burst into rings of sparks that fall and fade. */
function Fireworks({ id }: { id: number }) {
  const { width, height } = useWindowDimensions();
  const clear = useCelebration((s) => s.clear);
  const [shells] = useState(() => makeFireworks(SHELLS));
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const a = Animated.timing(progress, { toValue: 1, duration: SHOW_MS, easing: Easing.linear, useNativeDriver: true });
    a.start(({ finished }) => finished && clear(id));
    return () => a.stop();
  }, [progress, clear, id]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      {shells.map((sh, i) => (
        <ShellView key={i} shell={sh} progress={progress} width={width} height={height} />
      ))}
    </View>
  );
}

function ShellView({ shell, progress, width, height }: { shell: Shell; progress: Animated.Value; width: number; height: number }) {
  const cx = shell.x * width;
  const cy = shell.y * height;
  const launch = shell.start;
  const burst = launch + FIREWORK_RISE;
  const end = burst + FIREWORK_BURST;
  const color = COLORS[shell.color % COLORS.length];
  return (
    <>
      {/* rocket: a short streak that rises to the burst point and vanishes */}
      <Animated.View
        style={{
          position: 'absolute',
          left: cx - 1.5,
          top: cy,
          width: 3,
          height: 14,
          borderRadius: 1.5,
          backgroundColor: color,
          opacity: progress.interpolate({ inputRange: [0, launch, launch + 0.01, burst - 0.01, burst, 1], outputRange: [0, 0, 1, 1, 0, 0], extrapolate: 'clamp' }),
          transform: [{ translateY: progress.interpolate({ inputRange: [0, launch, burst, 1], outputRange: [height - cy, height - cy, 0, 0], extrapolate: 'clamp' }) }],
        }}
      />
      {shell.sparks.map((sp, j) => {
        const dx = Math.cos(sp.angle) * sp.dist;
        const dy = Math.sin(sp.angle) * sp.dist;
        const span = FIREWORK_BURST;
        // fast out, slow settle, plus gravity pulling the sparks down
        const at = [0, 0.3, 0.65, 1].map((q) => burst + span * q);
        const reach = [0, 0.72, 0.93, 1];
        const gravity = [0, 8, 26, 52];
        return (
          <Animated.View
            key={j}
            style={{
              position: 'absolute',
              left: cx - sp.size / 2,
              top: cy - sp.size / 2,
              width: sp.size,
              height: sp.size,
              borderRadius: sp.size / 2,
              backgroundColor: sp.color < 0 ? color : COLORS[sp.color % COLORS.length],
              opacity: progress.interpolate({ inputRange: [0, burst, burst + span * 0.45, end, 1], outputRange: [0, 1, 1, 0, 0], extrapolate: 'clamp' }),
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, ...at, 1], outputRange: [0, ...reach.map((r) => dx * r), dx], extrapolate: 'clamp' }) },
                { translateY: progress.interpolate({ inputRange: [0, ...at, 1], outputRange: [0, ...reach.map((r, k) => dy * r + gravity[k]), dy + 52], extrapolate: 'clamp' }) },
                { scale: progress.interpolate({ inputRange: [0, burst, end, 1], outputRange: [0, 1, 0.5, 0.5], extrapolate: 'clamp' }) },
              ],
            }}
          />
        );
      })}
    </>
  );
}
