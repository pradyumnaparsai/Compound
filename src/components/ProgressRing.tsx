import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';

type Props = {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode; // centered content
};

/**
 * Circular progress dial built from Views (no SVG dependency → no native rebuild).
 * Two clipped half-rings: the right half fills 0–180°, the left half 180–360°.
 */
export function ProgressRing({ value, size = 40, stroke = 4, color, children }: Props) {
  const t = useTheme();
  const c = color ?? t.success;
  const p = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const deg = p * 360;
  const half = size / 2;

  const circle = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: stroke,
    borderColor: 'transparent',
    borderTopColor: c,
    borderRightColor: c,
  };

  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.abs, { width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: p >= 1 ? c : t.surfaceAlt }]} />
      {p > 0 && p < 1 && (
        <>
          {/* right half: arc spans [r-45, r+135]°, clipped to 0–180° */}
          <View style={[styles.abs, { left: half, width: half, height: size, overflow: 'hidden' }]}>
            <View style={[circle, { left: -half, transform: [{ rotate: `${Math.min(deg, 180) - 135}deg` }] }]} />
          </View>
          {/* left half: clipped to 180–360° */}
          {deg > 180 && (
            <View style={[styles.abs, { left: 0, width: half, height: size, overflow: 'hidden' }]}>
              <View style={[circle, { left: 0, transform: [{ rotate: `${deg - 180 + 45}deg` }] }]} />
            </View>
          )}
        </>
      )}
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', top: 0 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
