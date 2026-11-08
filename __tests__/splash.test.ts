import { SPLASH_SKIP_FADE_MS, splashTimeline } from '@/domain/splash';

describe('splashTimeline', () => {
  it('runs about 2 seconds in total', () => {
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
});
