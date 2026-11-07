const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ordinal = (n: number) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

/** "just now", "5 minutes ago", "3 hours ago", else "on 6th Nov" (year added when not the current year). */
export function timeAgo(date: Date, now: Date = new Date()): string {
  const mins = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return plural(mins, 'minute');
  const hours = Math.floor(mins / 60);
  if (hours < 24) return plural(hours, 'hour');
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `on ${ordinal(date.getDate())} ${MONTHS[date.getMonth()]}${year}`;
}

export type VersionInfo = {
  appVersion: string;
  createdAt: Date | null;
  isEmbedded: boolean;
};

/** One display line, e.g. "v1.1.0 · Updated 5 minutes ago" ("Built …" for the bundle shipped inside the install). */
export function versionLine(info: VersionInfo, now: Date = new Date()): string {
  const kind = info.isEmbedded ? 'Built' : 'Updated';
  const when = info.createdAt ? timeAgo(info.createdAt, now) : 'unknown';
  return `v${info.appVersion} · ${kind} ${when}`;
}
