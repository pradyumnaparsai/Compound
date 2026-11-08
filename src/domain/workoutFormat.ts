import { fromKey } from './date';
import type { PR } from './records';
import { formatNumber, kgToUnit, type WeightUnit } from './units';
import { formatDuration, type ExerciseType, type Workout, type WorkoutSet } from './workout';

type SetLike = Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSeconds' | 'distanceMeters'>;

export const formatDistance = (meters: number): string =>
  meters >= 1000 ? `${formatNumber(meters / 1000, 2)} km` : `${formatNumber(meters, 0)} m`;

/** "1,240 kg" / "2,734 lb": total volume in the display unit with thousands separators. */
export function formatVolume(kg: number, unit: WeightUnit): string {
  const v = Math.round(kgToUnit(kg, unit));
  return `${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${unit}`;
}

/** Compact one-line description of a set, e.g. "80 kg × 8", "+10 kg × 6", "−30 kg × 5", "1:30", "2.5 km · 12:00". */
export function formatSet(s: SetLike, type: ExerciseType, unit: WeightUnit): string {
  const w = s.weightKg ?? 0;
  const weight = (kg: number) => `${formatNumber(Math.abs(kgToUnit(kg, unit)))} ${unit}`;
  const reps = s.reps ?? 0;
  switch (type) {
    case 'weight_reps':
      return w > 0 || reps > 0 ? `${weight(w)} × ${reps}` : '–';
    case 'bodyweight_reps':
      return reps > 0 ? (w > 0 ? `+${weight(w)} × ${reps}` : `× ${reps}`) : '–';
    case 'bodyweight_assisted_reps':
      return reps > 0 ? (w < 0 ? `−${weight(w)} × ${reps}` : `× ${reps}`) : '–';
    case 'reps_only':
      return reps > 0 ? `× ${reps}` : '–';
    case 'duration':
      return (s.durationSeconds ?? 0) > 0 ? formatDuration(s.durationSeconds as number) : '–';
    case 'weight_duration':
      return (s.durationSeconds ?? 0) > 0 ? `${weight(w)} · ${formatDuration(s.durationSeconds as number)}` : '–';
    case 'distance_duration': {
      const parts = [
        (s.distanceMeters ?? 0) > 0 ? formatDistance(s.distanceMeters as number) : null,
        (s.durationSeconds ?? 0) > 0 ? formatDuration(s.durationSeconds as number) : null,
      ].filter(Boolean);
      return parts.length ? parts.join(' · ') : '–';
    }
  }
}

/** Does the set have the numbers its exercise type needs, so ticking it makes sense? */
export function hasSetData(s: SetLike, type: ExerciseType): boolean {
  switch (type) {
    case 'weight_reps':
    case 'bodyweight_reps':
    case 'bodyweight_assisted_reps':
    case 'reps_only':
      return (s.reps ?? 0) > 0;
    case 'duration':
    case 'weight_duration':
      return (s.durationSeconds ?? 0) > 0;
    case 'distance_duration':
      return (s.distanceMeters ?? 0) > 0 || (s.durationSeconds ?? 0) > 0;
  }
}

/** Fills missing numbers of a set from the previous one (the quick "same as last time" tick). */
export function fillFromPrevious<S extends SetLike>(s: S, prev: SetLike | null): S {
  if (!prev) return s;
  return {
    ...s,
    weightKg: s.weightKg ?? prev.weightKg,
    reps: s.reps ?? prev.reps,
    durationSeconds: s.durationSeconds ?? prev.durationSeconds,
    distanceMeters: s.distanceMeters ?? prev.distanceMeters,
  };
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sun, 8 Nov" for a YYYY-MM-DD key (adds the year when it is not `thisYear`). */
export function formatDateLabel(key: string, thisYear?: number): string {
  const d = fromKey(key);
  const year = thisYear !== undefined && d.getFullYear() !== thisYear ? ` ${d.getFullYear()}` : '';
  return `${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}${year}`;
}

/** What a PR was, e.g. "100 kg", "12 reps at 60 kg", "est. 133.3 kg". */
export function formatPR(pr: PR, w: Pick<Workout, 'exercises'>, unit: WeightUnit): string {
  const set = w.exercises.flatMap((e) => e.sets).find((s) => s.id === pr.setId);
  const kg = (v: number) => `${formatNumber(kgToUnit(v, unit))} ${unit}`;
  switch (pr.kind) {
    case 'weight':
      return kg(pr.value);
    case 'oneRM':
      return `est. ${kg(pr.value)}`;
    case 'reps':
      return set && (set.weightKg ?? 0) > 0 ? `${pr.value} reps at ${kg(set.weightKg as number)}` : `${pr.value} reps`;
    case 'setVolume':
      return formatVolume(pr.value, unit);
    case 'duration':
      return formatDuration(pr.value);
    case 'distance':
      return formatDistance(pr.value);
  }
}
