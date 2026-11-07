import { timeAgo, versionLine } from '@/domain/version';

const now = new Date(2026, 10, 7, 12, 0, 0);
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;

describe('timeAgo', () => {
  it('handles sub-minute, minutes and hours', () => {
    expect(timeAgo(ago(20_000), now)).toBe('just now');
    expect(timeAgo(ago(MIN), now)).toBe('1 minute ago');
    expect(timeAgo(ago(5 * MIN), now)).toBe('5 minutes ago');
    expect(timeAgo(ago(60 * MIN), now)).toBe('1 hour ago');
    expect(timeAgo(ago(23 * 60 * MIN + 59 * MIN), now)).toBe('23 hours ago');
  });

  it('switches to a dated form after 24 hours', () => {
    expect(timeAgo(new Date(2026, 10, 6, 9, 0), now)).toBe('on 6th Nov');
    expect(timeAgo(new Date(2026, 10, 1, 9, 0), now)).toBe('on 1st Nov');
    expect(timeAgo(new Date(2026, 9, 2, 9, 0), now)).toBe('on 2nd Oct');
    expect(timeAgo(new Date(2026, 9, 3, 9, 0), now)).toBe('on 3rd Oct');
    expect(timeAgo(new Date(2026, 9, 11, 9, 0), now)).toBe('on 11th Oct');
    expect(timeAgo(new Date(2026, 9, 22, 9, 0), now)).toBe('on 22nd Oct');
  });

  it('adds the year when it is not the current year', () => {
    expect(timeAgo(new Date(2025, 11, 25, 9, 0), now)).toBe('on 25th Dec 2025');
  });
});

describe('versionLine', () => {
  it('shows version and update time', () => {
    expect(versionLine({ appVersion: '1.1.0', createdAt: ago(5 * MIN), isEmbedded: false }, now)).toBe(
      'v1.1.0 · Updated 5 minutes ago',
    );
  });

  it('labels the embedded bundle as built and handles missing time (dev)', () => {
    expect(versionLine({ appVersion: '1.0.0', createdAt: ago(2 * 60 * MIN), isEmbedded: true }, now)).toBe(
      'v1.0.0 · Built 2 hours ago',
    );
    expect(versionLine({ appVersion: '1.0.0', createdAt: null, isEmbedded: true }, now)).toBe('v1.0.0 · Built unknown');
  });
});
