import type { ReactNode } from 'react';
import { Keyboard, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  padBottom?: boolean;
  /** Tap-outside-to-dismiss keyboard. Only for non-scrolling screens — the wrapper competes with scroll gestures. */
  dismissKeyboardOnTap?: boolean;
};

export function Screen({ children, padBottom = false, dismissKeyboardOnTap = false }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const content = (
    <View
      style={[
        styles.root,
        { backgroundColor: t.bg, paddingTop: insets.top + 8, paddingBottom: padBottom ? insets.bottom : 0 },
      ]}
    >
      {children}
    </View>
  );
  if (!dismissKeyboardOnTap) return content;
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      {content}
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, paddingHorizontal: 20 } });
