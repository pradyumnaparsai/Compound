import { memo, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { layoutPattern, type PatternName } from '@/domain/poses';
import { usePoseClock } from './poseClock';

type Props = { pattern: PatternName; size: number; body: string; dim: string; accessibilityLabel?: string };

/** Looping stick-figure showing the movement. Pure Views + native-driven transforms (no images, no SVG). */
export const PoseFigure = memo(function PoseFigure({ pattern, size, body, dim, accessibilityLabel }: Props) {
  const lay = useMemo(() => layoutPattern(pattern, size), [pattern, size]);
  const clock = usePoseClock(lay.animated);
  const input = useMemo(() => Array.from({ length: lay.frames }, (_, i) => i / (lay.frames - 1)), [lay.frames]);
  const track = (values: number[]) => clock.interpolate({ inputRange: input, outputRange: values });
  const trackDeg = (values: number[]) => clock.interpolate({ inputRange: input, outputRange: values.map((v) => `${v}deg`) });

  return (
    <View style={{ width: size, height: size }} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} accessibilityRole="image">
      {lay.parts.map((p) => (
        <Animated.View
          key={p.key}
          style={[
            styles.abs,
            {
              left: p.cx[0] - p.length / 2,
              top: p.cy[0] - p.thick / 2,
              width: p.length,
              height: p.thick,
              borderRadius: p.thick / 2,
              backgroundColor: p.soft ? dim : body,
              opacity: p.key === 'cable' ? 0.85 : p.soft && p.key !== 'floor' ? 0.55 : p.key === 'floor' ? 0.5 : 1,
              transform: [
                { translateX: track(p.cx.map((x) => x - p.cx[0])) },
                { translateY: track(p.cy.map((y) => y - p.cy[0])) },
                { rotate: trackDeg(p.rot) },
                ...(p.sx ? [{ scaleX: track(p.sx) }] : []),
              ],
            },
          ]}
        />
      ))}
      <Animated.View
        style={[
          styles.abs,
          {
            left: lay.head.cx[0] - lay.head.r,
            top: lay.head.cy[0] - lay.head.r,
            width: lay.head.r * 2,
            height: lay.head.r * 2,
            borderRadius: lay.head.r,
            backgroundColor: body,
            transform: [{ translateX: track(lay.head.cx.map((x) => x - lay.head.cx[0])) }, { translateY: track(lay.head.cy.map((y) => y - lay.head.cy[0])) }],
          },
        ]}
      />
      {lay.load && (
        <Animated.View
          style={[
            styles.abs,
            {
              left: lay.load.cx[0] - lay.load.r,
              top: lay.load.cy[0] - lay.load.r,
              width: lay.load.r * 2,
              height: lay.load.r * 2,
              borderRadius: lay.load.r,
              backgroundColor: dim,
              transform: [{ translateX: track(lay.load.cx.map((x) => x - (lay.load as { cx: number[] }).cx[0])) }, { translateY: track(lay.load.cy.map((y) => y - (lay.load as { cy: number[] }).cy[0])) }],
            },
          ]}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({ abs: { position: 'absolute' } });
