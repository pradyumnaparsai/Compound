/** What the app-wide floating button does on the current screen. Tap = this; long-press always opens Atomic (AI). */
export type FabAction =
  | { kind: 'ai' }
  | { kind: 'log-food'; href: string; label: string }
  | { kind: 'new-routine'; href: string; label: string };

/** `segments` is expo-router's `useSegments()`; `date` is the day the Meals tab is showing. */
export function fabAction(segments: readonly string[], date: string): FabAction {
  if (segments[0] === '(tabs)') {
    if (segments[1] === 'meals') return { kind: 'log-food', href: `/log-meal?date=${date}`, label: 'Log food' };
    if (segments[1] === 'routines') return { kind: 'new-routine', href: '/routine-form', label: 'New routine' };
  }
  return { kind: 'ai' };
}
