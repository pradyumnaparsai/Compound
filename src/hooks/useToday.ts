import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todayKey } from '@/domain/date';

/** Today's date key, refreshed when the app returns to the foreground so a screen left open past midnight rolls over. */
export function useToday(): string {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setToday(todayKey());
    });
    return () => sub.remove();
  }, []);
  return today;
}
