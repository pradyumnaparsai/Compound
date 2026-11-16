import { addDays, fromKey, toKey, weekday } from './date';

export type WeightEntry = { date: string; kg: number };
export type WeeklyAverage = { weekStart: string; avg: number; count: number };

/** Sunday-first week start, consistent with the calendar. */
export const weekStart = (date: string) => addDays(date, -weekday(date));

/** Average per week for the last `weeks` weeks (oldest → newest); weeks with no entries are skipped. */
export function weeklyAverages(entries: WeightEntry[], today: string, weeks = 12): WeeklyAverage[] {
  const firstWeek = addDays(weekStart(today), -7 * (weeks - 1));
  const buckets = new Map<string, number[]>();
  for (const e of entries) {
    const w = weekStart(e.date);
    if (w < firstWeek) continue;
    buckets.set(w, [...(buckets.get(w) ?? []), e.kg]);
  }
  const out: WeeklyAverage[] = [];
  for (let i = 0; i < weeks; i++) {
    const w = addDays(firstWeek, 7 * i);
    const vals = buckets.get(w);
    if (vals?.length) {
      out.push({ weekStart: w, avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length });
    }
  }
  return out;
}

export type LinePoint = { weekStart: string; avg: number; x: number; y: number };
export type LineSegment = { cx: number; cy: number; length: number; angleDeg: number };
export type LineChartGeometry = {
  points: LinePoint[];
  segments: LineSegment[];
  ticks: { value: number; y: number }[];
  lo: number;
  hi: number;
};

const NICE_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
const dayDiff = (a: string, b: string) => Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);

/**
 * Pixel geometry for the weekly-average line chart: x follows the calendar (a skipped week leaves a gap),
 * y is scaled to round tick values just outside the data. `y = 0` is the top of the plot.
 */
export function lineChartGeometry(data: WeeklyAverage[], width: number, height: number, maxTicks = 5): LineChartGeometry {
  if (data.length === 0 || width <= 0 || height <= 0) return { points: [], segments: [], ticks: [], lo: 0, hi: 0 };
  const vals = data.map((d) => d.avg);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const raw = Math.max(max - min, 0.5) * 1.2 / Math.max(1, maxTicks - 1);
  const step = NICE_STEPS.find((s) => s >= raw) ?? NICE_STEPS[NICE_STEPS.length - 1];
  const mid = (min + max) / 2;
  const span = Math.max(max - min, 0.5) * 1.2;
  let lo = Math.floor((mid - span / 2) / step + 1e-9) * step;
  let hi = Math.ceil((mid + span / 2) / step - 1e-9) * step;
  if (hi - lo < step) hi = lo + step;
  lo = Number(lo.toFixed(6));
  hi = Number(hi.toFixed(6));

  const yOf = (v: number) => ((hi - v) / (hi - lo)) * height;
  const total = dayDiff(data[0].weekStart, data[data.length - 1].weekStart);
  const points = data.map((d) => ({
    weekStart: d.weekStart,
    avg: d.avg,
    x: total === 0 ? width / 2 : (dayDiff(data[0].weekStart, d.weekStart) / total) * width,
    y: yOf(d.avg),
  }));
  const segments = points.slice(1).map((b, i) => {
    const a = points[i];
    return {
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      length: Math.hypot(b.x - a.x, b.y - a.y),
      angleDeg: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    };
  });
  const ticks: { value: number; y: number }[] = [];
  const count = Math.round((hi - lo) / step);
  for (let i = 0; i <= count; i++) {
    const value = Number((lo + i * step).toFixed(6));
    ticks.push({ value, y: yOf(value) });
  }
  return { points, segments, ticks, lo, hi };
}

/** Indices of the points that get an x-axis label: all when few, otherwise every k-th, always including the newest. */
export function xLabelIndices(n: number, maxLabels = 5): number[] {
  if (n <= 0) return [];
  const k = Math.ceil(n / maxLabels);
  const out: number[] = [];
  for (let i = n - 1; i >= 0; i -= k) out.unshift(i);
  return out;
}

export const formatWeekLabel = (key: string) => {
  const d = fromKey(key);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

export { toKey };

/** Body weight to use for a date: the latest entry on or before it, else the earliest one after it. Null with no entries. */
export function weightOn(entries: WeightEntry[], date: string): number | null {
  let before: WeightEntry | null = null;
  let after: WeightEntry | null = null;
  for (const e of entries) {
    if (e.date <= date) {
      if (!before || e.date > before.date) before = e;
    } else if (!after || e.date < after.date) after = e;
  }
  return (before ?? after)?.kg ?? null;
}
