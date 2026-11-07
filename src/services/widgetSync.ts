import { Platform } from 'react-native';
import { addDays, fromKey, todayKey } from '@/domain/date';
import { completionKey, scheduledOn } from '@/domain/recurrence';
import type { Routine } from '@/domain/types';
import type { RoutineWidgetProps } from '@/widgets/RoutineWidget';

function propsFor(routines: Routine[], done: Set<string>, date: string): RoutineWidgetProps {
  const scheduled = scheduledOn(routines, date);
  const pending = scheduled.filter((r) => !done.has(completionKey(r.id, date)));
  return { done: scheduled.length - pending.length, total: scheduled.length, next: pending[0]?.title ?? '' };
}

/** Pushes today's progress to the lock-screen widget, plus a midnight entry so it resets on its own. */
export function syncWidget(routines: Routine[], done: Set<string>) {
  if (Platform.OS !== 'ios') return;
  try {
    // Lazy require: the native module is missing in Expo Go; fail soft there.
    const widget = require('@/widgets/RoutineWidget').default as {
      updateTimeline(entries: { date: Date; props: RoutineWidgetProps }[]): void;
    };
    const today = todayKey();
    const tomorrow = addDays(today, 1);
    widget.updateTimeline([
      { date: new Date(), props: propsFor(routines, done, today) },
      { date: fromKey(tomorrow), props: propsFor(routines, done, tomorrow) },
    ]);
  } catch (e) {
    if (__DEV__) console.warn('Widget sync unavailable (needs a development build):', e);
  }
}
