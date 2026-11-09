import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { notifyError } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { UserError } from '@/domain/errors';
import { parseGoalsInput } from '@/domain/meal';
import { useMealStore } from '@/store/useMealStore';
import { radius, useTheme } from '@/theme';

export default function MealTargetScreen() {
  const t = useTheme();
  const { goals, setGoals } = useMealStore();

  // null = untouched: show the saved goal and leave it alone on save
  const [calEdit, setCal] = useState<string | null>(null);
  const [protEdit, setProt] = useState<string | null>(null);
  const [carbEdit, setCarb] = useState<string | null>(null);
  const [fatEdit, setFat] = useState<string | null>(null);
  const cal = calEdit ?? (goals ? String(goals.calories) : '');
  const prot = protEdit ?? (goals ? String(goals.proteinG) : '');
  // blank carbs/fat = derived from the calorie and protein goals
  const carb = carbEdit ?? (goals?.carbsG !== undefined ? String(goals.carbsG) : '');
  const fat = fatEdit ?? (goals?.fatG !== undefined ? String(goals.fatG) : '');

  const save = async () => {
    try {
      if (calEdit !== null || protEdit !== null || carbEdit !== null || fatEdit !== null) {
        const parsed = parseGoalsInput(cal, prot, carb, fat);
        if (parsed === 'invalid')
          throw new UserError('Calories and protein must be positive numbers (carbs and fat are optional), or clear everything.');
        await setGoals(parsed);
      }
      router.back();
    } catch (e) {
      notifyError(e, 'Could not save', 'Could not save your meal target. Please try again.');
    }
  };

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text }];

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Text style={[styles.title, { color: t.text }]}>Meal target</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={[styles.label, { color: t.textDim }]}>DAILY GOALS</Text>
        <View style={styles.row}>
          <TextInput value={cal} onChangeText={setCal} keyboardType="number-pad" placeholder="Calories" placeholderTextColor={t.textDim} style={[input, { flex: 1 }]} />
          <TextInput value={prot} onChangeText={setProt} keyboardType="number-pad" placeholder="Protein (g)" placeholderTextColor={t.textDim} style={[input, { flex: 1 }]} />
        </View>
        <View style={styles.row}>
          <TextInput value={carb} onChangeText={setCarb} keyboardType="number-pad" placeholder="Carbs (g) · auto" placeholderTextColor={t.textDim} style={[input, { flex: 1 }]} />
          <TextInput value={fat} onChangeText={setFat} keyboardType="number-pad" placeholder="Fat (g) · auto" placeholderTextColor={t.textDim} style={[input, { flex: 1 }]} />
        </View>
        <Text style={{ color: t.textDim, fontSize: 12, marginTop: 8 }}>
          Leave carbs and fat blank to split the calories left after protein (70 % carbs, 30 % fat).
        </Text>

        <Pressable onPress={save} style={[styles.btn, { backgroundColor: t.accent, marginTop: 20 }]}>
          <Text style={styles.btnText}>Save</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: { borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  btn: { borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
