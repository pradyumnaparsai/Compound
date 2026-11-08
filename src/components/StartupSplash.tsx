import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, useWindowDimensions } from 'react-native';
import { SPLASH_SKIP_FADE_MS, splashTimeline } from '@/domain/splash';

// Full-screen portrait poster with the "COMPOUND" heading baked in (assets/splash-art.jpg).
const ART = require('../../assets/splash-art.jpg');
// Same yellow as the poster so nothing flashes before the image fades in.
const BACKDROP = '#F5B800';

/** Full-screen intro shown once per launch: the poster fades in, holds, then fades out. Tap to skip. */
export function StartupSplash() {
  const { width, height } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const [content] = useState(() => new Animated.Value(0)); // poster
  const [overlay] = useState(() => new Animated.Value(1)); // whole splash
  const running = useRef<Animated.CompositeAnimation | null>(null);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    setVisible(false);
  };

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        const tl = splashTimeline(reduce);
        if (tl.total === 0) return finish();
        const seq = Animated.sequence([
          Animated.timing(content, { toValue: 1, duration: tl.fadeIn, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.delay(tl.hold),
          Animated.timing(overlay, { toValue: 0, duration: tl.fadeOut, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]);
        running.current = seq;
        seq.start(({ finished: done }) => done && finish());
      });
    return () => {
      cancelled = true;
      running.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    running.current?.stop();
    Animated.timing(overlay, { toValue: 0, duration: SPLASH_SKIP_FADE_MS, useNativeDriver: true }).start(finish);
  };

  if (!visible) return null;
  return (
    <Animated.View
      style={{ position: 'absolute', top: 0, left: 0, width, height, backgroundColor: BACKDROP, zIndex: 1000, elevation: 1000, opacity: overlay }}
    >
      <Pressable style={{ width, height }} onPress={skip} accessibilityRole="button" accessibilityLabel="Compound. Tap to skip intro">
        <Animated.View style={{ width, height, opacity: content }}>
          <Image source={ART} resizeMode="cover" style={{ width, height }} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
