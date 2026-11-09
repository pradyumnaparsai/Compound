const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time date key, YYYY-MM-DD. */
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function weekday(key: string): number {
  return fromKey(key).getDay();
}

/** 6x7 grid of date keys (Sunday-first) covering the month; null = padding. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: count }, (_, i) => toKey(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** True for a real local YYYY-MM-DD key (rejects 2026-02-31 and junk). */
export function isDateKey(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && toKey(fromKey(v)) === v;
}

/** A `?date=` route param as a valid key, falling back to today. */
export function dateParam(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  return isDateKey(s) ? s : todayKey();
}

/** "Today" / "Yesterday" / "Tomorrow" / "Mon, Nov 9" */
export function dayTitle(key: string, today: string = todayKey()): string {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  if (key === addDays(today, 1)) return 'Tomorrow';
  return fromKey(key).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
