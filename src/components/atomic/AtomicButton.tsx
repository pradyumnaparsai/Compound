import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';

export type AtomicState = 'idle' | 'listening' | 'thinking' | 'speaking';

type Props = { state: AtomicState; size: number; /** idle shows the atom mark; the panel's main button shows a mic. */ mark?: 'atom' | 'mic' };

/**
 * Atomic's round button in the app's accent colour. One soft ring pulses outward while it listens or speaks;
 * nothing else moves.
 */
export function AtomicButton({ state, size, mark = 'mic' }: Props) {
  const t = useTheme();
  const [pulse] = useState(() => new Animated.Value(0));
  const active = state === 'listening' || state === 'speaking';

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const a = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: state === 'listening' ? 1300 : 1900, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [active, state, pulse]);

  const icon = Math.round(size * 0.46);
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {active && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: size / 2,
              backgroundColor: t.accent,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
            },
          ]}
        />
      )}
      <View
        style={[
          styles.disc,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: t.accent },
          size < 60 && styles.shadow,
        ]}
      >
        {state === 'thinking' ? (
          <ActivityIndicator color="#fff" />
        ) : state === 'listening' ? (
          <Ionicons name="stop" size={icon * 0.8} color="#fff" />
        ) : state === 'speaking' ? (
          <Ionicons name="volume-high" size={icon} color="#fff" />
        ) : mark === 'atom' ? (
          <MaterialCommunityIcons name="atom" size={icon * 1.15} color="#fff" />
        ) : (
          <Ionicons name="mic" size={icon} color="#fff" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center' },
  shadow: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});
