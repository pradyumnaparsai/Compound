import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

// One looping 0 → 1 → 0 value shared by every figure on screen: a single native animation drives them all
// (cheap even with a long exercise list) and they move in sync. It only runs while a figure is mounted.
const value = new Animated.Value(0);
const still = new Animated.Value(0);
let users = 0;
let loop: Animated.CompositeAnimation | null = null;

const HOLD = 220;
const SWING = 950;

function start() {
  if (loop) return;
  const swing = (to: number) => Animated.timing(value, { toValue: to, duration: SWING, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
  loop = Animated.loop(Animated.sequence([Animated.delay(HOLD), swing(1), Animated.delay(HOLD), swing(0)]));
  loop.start();
}

function stop() {
  loop?.stop();
  loop = null;
  value.setValue(0);
}

/** The shared animation clock, or a frozen one when the system asks for reduced motion (or `animated` is false). */
export function usePoseClock(animated: boolean): Animated.Value {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => live && setReduce(r)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  const run = animated && !reduce;
  useEffect(() => {
    if (!run) return;
    users += 1;
    start();
    return () => {
      users -= 1;
      if (users === 0) stop();
    };
  }, [run]);
  return run ? value : still;
}
