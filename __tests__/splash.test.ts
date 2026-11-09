import { SPLASH_READY_TIMEOUT_MS, SPLASH_SKIP_FADE_MS, splashTimeline } from '@/domain/splash';

describe('splashTimeline', () => {
  it('runs exactly 3 seconds in total', () => {
    const t = splashTimeline(false);
    expect(t.total).toBe(3000);
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
