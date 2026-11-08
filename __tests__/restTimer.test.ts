import { adjustEnd, remainingSeconds, restProgress } from '@/domain/restTimer';

describe('restTimer', () => {
  it('remaining rounds up and never goes negative', () => {
    expect(remainingSeconds(null, 1000)).toBe(0);
    expect(remainingSeconds(11_000, 1000)).toBe(10);
    expect(remainingSeconds(10_100, 1000)).toBe(10);
    expect(remainingSeconds(1000, 5000)).toBe(0);
  });
  it('survives a long background gap (clock based)', () => {
    expect(remainingSeconds(100_000, 40_000)).toBe(60);
    expect(remainingSeconds(100_000, 100_000)).toBe(0);
  });
  it('adjusts by seconds but not before now', () => {
    expect(adjustEnd(10_000, 15, 0)).toBe(25_000);
    expect(adjustEnd(10_000, -15, 0)).toBe(0);
    expect(adjustEnd(10_000, -15, 4_000)).toBe(4_000);
  });
  it('progress is clamped 0..1', () => {
    expect(restProgress(10_000, 20, 0)).toBe(0.5);
    expect(restProgress(100_000, 20, 0)).toBe(1);
    expect(restProgress(null, 20, 0)).toBe(0);
    expect(restProgress(10_000, 0, 0)).toBe(0);
  });
});
