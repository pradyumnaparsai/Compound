import { lineChartGeometry, xLabelIndices, type WeeklyAverage } from '@/domain/weight';

const wk = (weekStart: string, avg: number): WeeklyAverage => ({ weekStart, avg, count: 3 });

describe('lineChartGeometry', () => {
  it('returns nothing for empty data or no size', () => {
    expect(lineChartGeometry([], 300, 150).points).toEqual([]);
    expect(lineChartGeometry([wk('2026-11-01', 80)], 0, 150).points).toEqual([]);
  });

  it('centres a single week and makes no segments', () => {
    const g = lineChartGeometry([wk('2026-11-01', 80)], 300, 150);
    expect(g.points).toHaveLength(1);
    expect(g.points[0].x).toBe(150);
    expect(g.segments).toEqual([]);
    expect(g.lo).toBeLessThan(80);
    expect(g.hi).toBeGreaterThan(80);
  });

  it('puts heavier weeks higher (smaller y) and spans the full width', () => {
    const g = lineChartGeometry([wk('2026-10-18', 82), wk('2026-10-25', 81), wk('2026-11-01', 80)], 200, 100);
    expect(g.points[0].x).toBe(0);
    expect(g.points[2].x).toBe(200);
    expect(g.points[0].y).toBeLessThan(g.points[1].y);
    expect(g.points[1].y).toBeLessThan(g.points[2].y);
    expect(g.segments).toHaveLength(2);
    expect(g.segments[0].angleDeg).toBeGreaterThan(0); // descending to the right
  });

  it('leaves a gap for a skipped week', () => {
    const g = lineChartGeometry([wk('2026-10-18', 80), wk('2026-10-25', 80), wk('2026-11-08', 80)], 300, 100);
    expect(g.points[1].x).toBe(100); // 7 of 21 days
    expect(g.points[2].x).toBe(300);
  });

  it('keeps every point inside the plot and ticks on round values', () => {
    const g = lineChartGeometry([wk('2026-10-18', 79.4), wk('2026-10-25', 80.1), wk('2026-11-01', 80.9)], 200, 150);
    for (const p of g.points) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(150);
    }
    expect(g.ticks.length).toBeGreaterThanOrEqual(2);
    expect(g.ticks[0].y).toBeCloseTo(150, 5); // lowest tick at the bottom
    expect(g.ticks[g.ticks.length - 1].y).toBeCloseTo(0, 5);
    for (const tk of g.ticks) expect(tk.value * 10).toBeCloseTo(Math.round(tk.value * 10), 5);
  });

  it('handles flat data without dividing by zero', () => {
    const g = lineChartGeometry([wk('2026-10-25', 70), wk('2026-11-01', 70)], 100, 100);
    expect(g.hi).toBeGreaterThan(g.lo);
    expect(Number.isFinite(g.points[0].y)).toBe(true);
    expect(g.points[0].y).toBe(g.points[1].y);
  });

  it('scales to lb-sized numbers with a coarser step', () => {
    const g = lineChartGeometry([wk('2026-10-18', 170), wk('2026-11-01', 180)], 200, 100);
    expect(g.ticks.length).toBeLessThanOrEqual(7);
    expect(g.lo).toBeLessThanOrEqual(170);
    expect(g.hi).toBeGreaterThanOrEqual(180);
  });
});

describe('xLabelIndices', () => {
  it('labels every point when there are few', () => {
    expect(xLabelIndices(4)).toEqual([0, 1, 2, 3]);
    expect(xLabelIndices(0)).toEqual([]);
  });

  it('thins out many points but always keeps the newest', () => {
    const idx = xLabelIndices(12);
    expect(idx[idx.length - 1]).toBe(11);
    expect(idx.length).toBeLessThanOrEqual(6);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
});
