import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { orbPalette, type OrbMode } from './palette';

type Props = { mode: OrbMode; size: number };

const loop = (v: Animated.Value, duration: number, easing = Easing.linear, delay = 0) =>
  Animated.loop(
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true }),
    ]),
  );

/**
 * The assistant's face: a glowing liquid orb. Two translucent blobs swirl inside it (faster while thinking),
 * sonar rings pulse outward while listening, and equaliser bars dance while it speaks.
 */
export function AssistantOrb({ mode, size }: Props) {
  const [spin] = useState(() => new Animated.Value(0));
  const [breathe] = useState(() => new Animated.Value(0));
  const [ring1] = useState(() => new Animated.Value(0));
  const [ring2] = useState(() => new Animated.Value(0));
  const [bars] = useState(() => [0, 1, 2, 3, 4].map(() => new Animated.Value(0)));

  useEffect(() => {
    spin.setValue(0);
    const ms = mode === 'thinking' ? 1600 : mode === 'listening' ? 3800 : 9000;
    const a = loop(spin, ms);
    a.start();
    return () => a.stop();
  }, [mode, spin]);

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [breathe]);

  useEffect(() => {
    ring1.setValue(0);
    ring2.setValue(0);
    const ms = mode === 'listening' ? 1400 : mode === 'idle' ? 3200 : 2200;
    const a = loop(ring1, ms, Easing.out(Easing.quad));
    const b = loop(ring2, ms, Easing.out(Easing.quad), ms / 2);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [mode, ring1, ring2]);

  useEffect(() => {
    if (mode !== 'speaking') {
      bars.forEach((b) => b.setValue(0));
      return;
    }
    const anims = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 260 + i * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(b, { toValue: 0, duration: 260 + i * 55, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [mode, bars]);

  const p = orbPalette[mode];
  const r = size / 2;
  const showIcon = size >= 44;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateBack = spin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, mode === 'listening' ? 1.1 : 1.05] });
  const peak = mode === 'idle' ? 0.22 : 0.5;
  const ringStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [peak, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
  });
  const fill = StyleSheet.absoluteFill;

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {[ring1, ring2].map((v, i) => (
        <Animated.View
          key={i}
          style={[
            fill,
            { borderRadius: r, borderWidth: 1.5, borderColor: p.a },
            ringStyle(v),
          ]}
        />
      ))}
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: p.base,
          transform: [{ scale }],
          shadowColor: p.a,
          shadowOpacity: 0.85,
          shadowRadius: size * 0.32,
          shadowOffset: { width: 0, height: 0 },
          elevation: 10,
        }}
      >
        <View style={[fill, { borderRadius: r, overflow: 'hidden' }]}>
          <Animated.View style={[fill, { transform: [{ rotate }] }]}>
            <View
              style={{
                position: 'absolute',
                width: size * 0.95,
                height: size * 0.95,
                borderRadius: size,
                left: -size * 0.28,
                top: -size * 0.12,
                backgroundColor: p.a,
                opacity: 0.72,
              }}
            />
          </Animated.View>
          <Animated.View style={[fill, { transform: [{ rotate: rotateBack }] }]}>
            <View
              style={{
                position: 'absolute',
                width: size * 0.8,
                height: size * 0.8,
                borderRadius: size,
                right: -size * 0.3,
                bottom: -size * 0.22,
                backgroundColor: p.b,
                opacity: 0.6,
              }}
            />
          </Animated.View>
          <View
            style={{
              position: 'absolute',
              width: size * 0.5,
              height: size * 0.3,
              borderRadius: size,
              top: size * 0.08,
              left: size * 0.16,
              backgroundColor: '#fff',
              opacity: 0.22,
            }}
          />
        </View>
        <View style={[fill, { borderRadius: r, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }]} />
        {showIcon && (
          <View style={[fill, styles.center]}>
            {mode === 'speaking' ? (
              <View style={styles.bars}>
                {bars.map((b, i) => (
                  <Animated.View
                    key={i}
                    style={{
                      width: Math.max(3, size * 0.05),
                      height: size * 0.32,
                      borderRadius: 3,
                      backgroundColor: '#fff',
                      transform: [{ scaleY: b.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }],
                    }}
                  />
                ))}
              </View>
            ) : mode === 'thinking' ? (
              <Ionicons name="ellipsis-horizontal" size={size * 0.34} color="#fff" />
            ) : (
              <Ionicons name={mode === 'listening' ? 'mic' : 'sparkles'} size={size * 0.38} color="#fff" />
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
