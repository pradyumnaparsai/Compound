import { SPLASH_CLIP_SECONDS, SPLASH_READY_TIMEOUT_MS, SPLASH_SKIP_FADE_MS, splashPlaybackRate, splashTimeline } from '@/domain/splash';

describe('splashTimeline', () => {
  it('runs exactly 2 seconds in total', () => {
    const t = splashTimeline(false);
    expect(t.total).toBe(2000);
    expect(t.fadeIn + t.hold + t.fadeOut).toBe(t.total);
    expect(t.fadeIn).toBeGreaterThan(0);
    expect(t.fadeOut).toBeGreaterThan(0);
  });

  it('is skipped entirely with Reduce Motion', () => {
    expect(splashTimeline(true)).toEqual({ fadeIn: 0, hold: 0, fadeOut: 0, total: 0 });
  });

  it('skip fade is much shorter than the normal fade-out', () => {
    expect(SPLASH_SKIP_FADE_MS).toBeLessThan(splashTimeline(false).fadeOut);
  });

  it('gives up waiting for the video well before the splash would feel stuck', () => {
    expect(SPLASH_READY_TIMEOUT_MS).toBeLessThanOrEqual(1500);
  });
});

describe('splashPlaybackRate', () => {
  it('plays the 4.07s clip at ~2x to fit the 2s splash', () => {
    const rate = splashPlaybackRate(SPLASH_CLIP_SECONDS, splashTimeline(false).total);
    expect(rate).toBeCloseTo(2.03, 2);
  });

  it('never slows a short clip below normal speed', () => {
    expect(splashPlaybackRate(1, 2000)).toBe(1);
  });

  it('falls back to normal speed on invalid input', () => {
    expect(splashPlaybackRate(0, 2000)).toBe(1);
    expect(splashPlaybackRate(4, 0)).toBe(1);
    expect(splashPlaybackRate(NaN, 2000)).toBe(1);
  });
});
