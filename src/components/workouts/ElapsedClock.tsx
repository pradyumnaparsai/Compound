import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { formatDuration, workoutDurationSeconds } from '@/domain/workout';

/** Time since `startedAt`; owns its own 1 s tick so the rest of the screen does not re-render every second. */
export function ElapsedClock({ startedAt, style }: { startedAt: string; style?: StyleProp<TextStyle> }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <Text style={[{ fontVariant: ['tabular-nums'] }, style]}>{formatDuration(workoutDurationSeconds({ startedAt, endedAt: null }, now))}</Text>;
}
