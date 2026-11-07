import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTaskStore } from '@/store/useTaskStore';
import { radius, useTheme } from '@/theme';

/** Inline "add a one-off task for `date`" input. */
export function TaskAdder({ date, placeholder = 'Add a task…' }: { date: string; placeholder?: string }) {
  const t = useTheme();
  const add = useTaskStore((s) => s.add);
  const [text, setText] = useState('');
  const canAdd = text.trim().length > 0;

  const submit = () => {
    if (!canAdd) return;
    const title = text;
    setText('');
    add(title, date).catch((e) => {
      console.error(e);
      setText(title);
    });
  };

  return (
    <View style={[styles.wrap, { backgroundColor: t.surface, borderColor: t.border }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor={t.textDim}
        returnKeyType="done"
        submitBehavior="submit"
        maxLength={120}
        style={[styles.input, { color: t.text }]}
      />
      <Pressable
        onPress={submit}
        disabled={!canAdd}
        hitSlop={8}
        accessibilityLabel="Add task"
        style={[styles.btn, { backgroundColor: t.accent, opacity: canAdd ? 1 : 0.35 }]}
      >
        <Ionicons name="add" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingLeft: 14,
    paddingRight: 6,
    marginBottom: 10,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  btn: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
