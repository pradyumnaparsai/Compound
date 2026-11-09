// Timing for the startup splash. Kept pure so it is unit-testable.

export type SplashTimeline = {
  /** Video + title fade in. */
  fadeIn: number;
  /** Fully visible while the clip finishes. */
  hold: number;
  /** Whole splash fades away, revealing the home screen. */
  fadeOut: number;
  total: number;
};

const FADE_IN_MS = 250;
const HOLD_MS = 1250;
const FADE_OUT_MS = 500;

/** Fade-out used when the user taps to skip. */
export const SPLASH_SKIP_FADE_MS = 200;

/** Length of assets/BruceLee.mov. */
export const SPLASH_CLIP_SECONDS = 4.067;

/** If the video isn't ready by then, give up waiting and start the timeline anyway. */
export const SPLASH_READY_TIMEOUT_MS = 1200;

/** Exactly 2s in total; with Reduce Motion enabled the splash is skipped entirely. */
export function splashTimeline(reduceMotion: boolean): SplashTimeline {
  if (reduceMotion) return { fadeIn: 0, hold: 0, fadeOut: 0, total: 0 };
  return { fadeIn: FADE_IN_MS, hold: HOLD_MS, fadeOut: FADE_OUT_MS, total: FADE_IN_MS + HOLD_MS + FADE_OUT_MS };
}

/** Playback rate that squeezes a clip into `targetMs` (never slower than normal speed). */
export function splashPlaybackRate(clipSeconds: number, targetMs: number): number {
  if (!(clipSeconds > 0) || !(targetMs > 0)) return 1;
  return Math.max(1, clipSeconds / (targetMs / 1000));
}
