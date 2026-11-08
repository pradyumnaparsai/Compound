import { useState } from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '@/theme';

type Props = {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  /** Shown text for a value (default: String). */
  format?: (v: number) => string;
  /** Parses typed text; null = empty/invalid. Default: plain decimal with comma support. */
  parse?: (text: string) => number | null;
  integer?: boolean;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

const defaultParse = (s: string): number | null => {
  const x = s.trim().replace(',', '.');
  if (x === '' || x === '-' || x === '.') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

/**
 * Numeric input that keeps what the user typed ("62." stays "62.") and only re-formats when the value
 * is changed from outside.
 */
export function NumField({ value, onChange, placeholder, format = String, parse = defaultParse, integer, style, accessibilityLabel }: Props) {
  const t = useTheme();
  const [text, setText] = useState(value === null ? '' : format(value));

  // Re-format only when the value is changed from outside (derived-state pattern; no effect needed).
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    const typed = parse(text);
    const same = typed === value || (typed !== null && value !== null && Math.abs(typed - value) < 1e-6);
    if (!same) setText(value === null ? '' : format(value));
  }

  return (
    <TextInput
      value={text}
      onChangeText={(s) => {
        const cleaned = integer ? s.replace(/[^0-9]/g, '') : s;
        setText(cleaned);
        const n = parse(cleaned);
        onChange(n === null ? null : integer ? Math.round(n) : n);
      }}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      placeholder={placeholder ?? '–'}
      placeholderTextColor={t.textDim}
      selectTextOnFocus
      accessibilityLabel={accessibilityLabel}
      style={[styles.input, { backgroundColor: t.surfaceAlt, color: t.text }, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: { flex: 1, minWidth: 0, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6, textAlign: 'center', fontSize: 15, fontWeight: '600' },
});
