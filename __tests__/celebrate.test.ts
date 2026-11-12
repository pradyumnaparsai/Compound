import { FIREWORK_BURST, FIREWORK_MAX_START, FIREWORK_RISE, crossedThreshold, makeFireworks, isWorkoutMilestone, makeParticles, ordinal, workoutCongrats } from '@/domain/celebrate';
import { fabAction } from '@/domain/fabAction';

describe('crossedThreshold', () => {
  it('fires only on the step that reaches the threshold', () => {
    expect(crossedThreshold(0.6, 0.8)).toBe(true);
    expect(crossedThreshold(0.75, 1)).toBe(true);
  });
  it('does not fire when already above, still below, or unknown before', () => {
    expect(crossedThreshold(0.8, 1)).toBe(false);
    expect(crossedThreshold(0.5, 0.79)).toBe(false);
    expect(crossedThreshold(null, 1)).toBe(false);
  });
  it('does not fire when going down', () => {
    expect(crossedThreshold(1, 0.5)).toBe(false);
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'],
    [21, '21st'], [22, '22nd'], [50, '50th'], [101, '101st'], [111, '111th'], [112, '112th'],
  ])('%i -> %s', (n, s) => expect(ordinal(n)).toBe(s));
});

describe('workout milestones', () => {
  it('flags 1, 10, 25 and every 50', () => {
    for (const n of [1, 10, 25, 50, 100, 150, 500]) expect(isWorkoutMilestone(n)).toBe(true);
    for (const n of [2, 9, 11, 24, 49, 51, 99, 101]) expect(isWorkoutMilestone(n)).toBe(false);
  });
  it('writes the congratulation line', () => {
    expect(workoutCongrats(7)).toEqual({ milestone: false, text: 'Congratulations on logging your 7th workout!' });
    expect(workoutCongrats(50)).toEqual({ milestone: true, text: 'Milestone! You just logged your 50th workout!' });
    expect(workoutCongrats(1)?.milestone).toBe(true);
  });
  it('returns nothing for an invalid count', () => {
    expect(workoutCongrats(0)).toBeNull();
    expect(workoutCongrats(-3)).toBeNull();
    expect(workoutCongrats(1.5)).toBeNull();
  });
});

describe('makeParticles', () => {
  it('makes the requested number, deterministic for a fixed rand', () => {
    const a = makeParticles(10, () => 0.5);
    expect(a).toHaveLength(10);
    expect(a).toEqual(makeParticles(10, () => 0.5));
    expect(makeParticles(0)).toEqual([]);
    expect(makeParticles(-2)).toEqual([]);
  });
  it('keeps values in range', () => {
    for (const p of makeParticles(200)) {
      expect(p.vy).toBeLessThan(0); // launched upwards
      expect(p.delay).toBeGreaterThanOrEqual(0);
      expect(p.delay).toBeLessThan(0.25);
      expect(p.color).toBeGreaterThanOrEqual(0);
      expect(p.color).toBeLessThan(6);
    }
  });
});

describe('fabAction', () => {
  it('is Log food on Meals, for the day being viewed', () => {
    expect(fabAction(['(tabs)', 'meals'], '2026-11-10')).toEqual({ kind: 'log-food', href: '/log-meal?date=2026-11-10', label: 'Log food' });
  });
  it('is New routine on Routines', () => {
    expect(fabAction(['(tabs)', 'routines'], '2026-11-12')).toEqual({ kind: 'new-routine', href: '/routine-form', label: 'New routine' });
  });
  it('is the AI button everywhere else', () => {
    for (const seg of [['(tabs)'], ['(tabs)', 'calendar'], ['(tabs)', 'body'], ['(tabs)', 'index'], ['workout'], ['meals'], []]) {
      expect(fabAction(seg, '2026-11-12')).toEqual({ kind: 'ai' });
    }
  });
});

describe('makeFireworks', () => {
  it('makes the requested shells and sparks', () => {
    const shells = makeFireworks(5, 12);
    expect(shells).toHaveLength(5);
    for (const s of shells) expect(s.sparks).toHaveLength(12);
    expect(makeFireworks(0)).toEqual([]);
  });
  it.each([0, 0.5, 0.999])('keeps every shell on screen and finishing inside the show (rand=%d)', (r) => {
    for (const s of makeFireworks(6, 18, () => r)) {
      expect(s.x).toBeGreaterThanOrEqual(0.15);
      expect(s.x).toBeLessThanOrEqual(0.85);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(0.5);
      expect(s.start).toBeGreaterThanOrEqual(0);
      expect(s.start).toBeLessThanOrEqual(FIREWORK_MAX_START);
      expect(s.start + FIREWORK_RISE + FIREWORK_BURST).toBeLessThanOrEqual(1);
    }
  });
  it('launches shells in order', () => {
    const starts = makeFireworks(6, 4, () => 0.5).map((s) => s.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
  it('handles a single shell', () => {
    const [s] = makeFireworks(1);
    expect(s).toMatchObject({ x: expect.any(Number), start: 0 });
  });
});
