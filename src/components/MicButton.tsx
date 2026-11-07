import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import type { VoiceState } from '@/hooks/useVoiceInput';
import { useTheme } from '@/theme';

type Props = { state: VoiceState; onPress: () => void; size?: number };

/** Tap to speak, tap again to stop. Turns solid while recording and spins while transcribing. */
export function MicButton({ state, onPress, size = 36 }: Props) {
  const t = useTheme();
  const recording = state === 'recording';
  return (
    <Pressable
      onPress={onPress}
      disabled={state === 'transcribing'}
      hitSlop={6}
      accessibilityLabel={recording ? 'Stop recording' : 'Speak instead of typing'}
      style={[
        styles.btn,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: recording ? t.accent : t.surfaceAlt },
      ]}
    >
      {state === 'transcribing' ? (
        <ActivityIndicator size="small" color={t.accent} />
      ) : (
        <Ionicons name={recording ? 'stop' : 'mic-outline'} size={recording ? 14 : 18} color={recording ? '#fff' : t.accent} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({ btn: { alignItems: 'center', justifyContent: 'center' } });
