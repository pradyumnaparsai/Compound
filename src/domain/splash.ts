// Timing and shading for the startup splash. Kept pure so it is unit-testable.

export type SplashTimeline = {
  /** Artwork + heading fade in. */
  fadeIn: number;
  /** Fully visible. */
  hold: number;
  /** Whole splash fades away, revealing the home screen. */
  fadeOut: number;
  total: number;
};

const FADE_IN_MS = 600;
const HOLD_MS = 900;
const FADE_OUT_MS = 500;

/** Fade-out used when the user taps to skip. */
export const SPLASH_SKIP_FADE_MS = 200;

/** ~2s in total; with Reduce Motion enabled the splash is skipped entirely. */
export function splashTimeline(reduceMotion: boolean): SplashTimeline {
  if (reduceMotion) return { fadeIn: 0, hold: 0, fadeOut: 0, total: 0 };
  return { fadeIn: FADE_IN_MS, hold: HOLD_MS, fadeOut: FADE_OUT_MS, total: FADE_IN_MS + HOLD_MS + FADE_OUT_MS };
}
