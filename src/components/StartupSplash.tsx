import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import {
  SPLASH_CLIP_SECONDS,
  SPLASH_READY_TIMEOUT_MS,
  SPLASH_SKIP_FADE_MS,
  splashPlaybackRate,
  splashTimeline,
} from '@/domain/splash';
import { darkTheme } from '@/theme';

const VIDEO = require('../../assets/BruceLee.mov');
// Dark sepia matching the clip's backdrop so nothing flashes before the first frame.
const BACKDROP = '#1C1208';

/**
 * Full-screen intro shown once per launch: a muted ~2s clip (sped up to fit) with the "COMPOUND" title,
 * then the whole splash fades out onto the home screen. Tap to skip.
 */
export function StartupSplash() {
  const [visible, setVisible] = useState(true);
  // The player lives in the inner component so it is released as soon as the splash is gone.
  return visible ? <SplashContent onDone={() => setVisible(false)} /> : null;
}

function SplashContent({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const [content] = useState(() => new Animated.Value(0)); // video + title
  const [overlay] = useState(() => new Animated.Value(1)); // whole splash
  const running = useRef<Animated.CompositeAnimation | null>(null);
  const started = useRef(false);
  const finished = useRef(false);
  const reduceMotion = useRef<boolean | null>(null);
  const timedOut = useRef(false);

  const player = useVideoPlayer(VIDEO, (p) => {
    p.muted = true;
    p.loop = false;
    p.audioMixingMode = 'mixWithOthers';
    p.showNowPlayingNotification = false;
    p.playbackRate = splashPlaybackRate(SPLASH_CLIP_SECONDS, splashTimeline(false).total);
  });

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);

  const start = useCallback(() => {
    if (started.current || finished.current || reduceMotion.current === null) return;
    started.current = true;
    const tl = splashTimeline(reduceMotion.current);
    if (tl.total === 0) return finish();
    player.play();
    const seq = Animated.sequence([
      Animated.timing(content, { toValue: 1, duration: tl.fadeIn, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(tl.hold),
      Animated.timing(overlay, { toValue: 0, duration: tl.fadeOut, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]);
    running.current = seq;
    seq.start(({ finished: done }) => done && finish());
  }, [content, finish, overlay, player]);

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') start();
    else if (status === 'error') finish(); // never block the app on a broken clip
  });

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        reduceMotion.current = reduce;
        if (reduce) return finish();
        if (player.status === 'readyToPlay' || timedOut.current) start();
      });
    // Don't hang on the splash if the video is slow to load.
    const timer = setTimeout(() => {
      timedOut.current = true;
      start();
    }, SPLASH_READY_TIMEOUT_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      running.current?.stop();
    };
  }, [finish, player, start]);

  const skip = () => {
    started.current = true; // stop the ready-timeout from restarting the sequence
    running.current?.stop();
    player.pause();
    Animated.timing(overlay, { toValue: 0, duration: SPLASH_SKIP_FADE_MS, useNativeDriver: true }).start(finish);
  };

  return (
    <Animated.View style={[styles.root, { width, height, opacity: overlay }]}>
      <Pressable style={{ width, height }} onPress={skip} accessibilityRole="button" accessibilityLabel="Compound. Tap to skip intro">
        <Animated.View style={{ width, height, opacity: content }}>
          <VideoView
            player={player}
            nativeControls={false}
            contentFit="cover"
            allowsPictureInPicture={false}
            pointerEvents="none"
            style={{ width, height }}
          />
          <Animated.Text
            style={[
              styles.title,
              { opacity: content, transform: [{ translateY: content.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
            ]}
          >
            COMPOUND
          </Animated.Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, backgroundColor: BACKDROP, zIndex: 1000, elevation: 1000 },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '12%',
    textAlign: 'center',
    color: darkTheme.text,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 10,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
});
