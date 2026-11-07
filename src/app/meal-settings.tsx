import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { notifyError, onFail } from '@/components/notify';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { UserError } from '@/domain/errors';
import {
  clearApiKey,
  clearGroqKey,
  DEFAULT_GROQ_MODEL,
  DEFAULT_MODEL,
  getApiKey,
  getGroqKey,
  getGroqModel,
  getModel,
  setApiKey,
  setGroqKey,
  setGroqModel,
  setModel,
} from '@/services/mealAnalyzer';
import { DEFAULT_LIMITS, getLimit, getUsageToday, setLimit, type Provider, type Usage } from '@/services/aiUsage';
import { useMealStore } from '@/store/useMealStore';
import { radius, useTheme } from '@/theme';

export default function MealSettingsScreen() {
  const t = useTheme();
  const { goals, setGoals } = useMealStore();

  const [hasKey, setHasKey] = useState(false);
  const [hasGroq, setHasGroq] = useState(false);
  const [keyText, setKeyText] = useState('');
  const [modelText, setModelText] = useState(DEFAULT_MODEL);
  const [groqKeyText, setGroqKeyText] = useState('');
  const [groqModelText, setGroqModelText] = useState(DEFAULT_GROQ_MODEL);
  // null = untouched: show the saved goal and leave it alone on save
  const [goalCalEdit, setGoalCal] = useState<string | null>(null);
  const [goalProtEdit, setGoalProt] = useState<string | null>(null);
  const [goalCarbEdit, setGoalCarb] = useState<string | null>(null);
  const [goalFatEdit, setGoalFat] = useState<string | null>(null);
  const goalCal = goalCalEdit ?? (goals ? String(goals.calories) : '');
  const goalProt = goalProtEdit ?? (goals ? String(goals.proteinG) : '');
  // blank carbs/fat = derived from the calorie and protein goals
  const goalCarb = goalCarbEdit ?? (goals?.carbsG !== undefined ? String(goals.carbsG) : '');
  const goalFat = goalFatEdit ?? (goals?.fatG !== undefined ? String(goals.fatG) : '');

  const [usage, setUsage] = useState<Record<Provider, Usage> | null>(null);
  const [limits, setLimits] = useState<Record<Provider, string>>({
    groq: String(DEFAULT_LIMITS.groq),
    gemini: String(DEFAULT_LIMITS.gemini),
  });

  useEffect(() => {
    getUsageToday().then(setUsage).catch(() => {});
    (['groq', 'gemini'] as Provider[]).forEach((p) =>
      getLimit(p).then((n) => setLimits((l) => ({ ...l, [p]: String(n) }))).catch(() => {}),
    );
    getApiKey().then((k) => setHasKey(!!k)).catch(() => {});
    getGroqKey().then((k) => setHasGroq(!!k)).catch(() => {});
    getModel().then(setModelText).catch(() => {});
    getGroqModel().then(setGroqModelText).catch(() => {});
  }, []);

  const save = async () => {
    try {
      if (keyText.trim()) await setApiKey(keyText);
      if (groqKeyText.trim()) await setGroqKey(groqKeyText);
      await setModel(modelText);
      await setGroqModel(groqModelText);
      await Promise.all((['groq', 'gemini'] as Provider[]).map((p) => setLimit(p, Number(limits[p].replace(/[,\s]/g, '')))));
      if (goalCalEdit !== null || goalProtEdit !== null || goalCarbEdit !== null || goalFatEdit !== null) {
        const num = (v: string) => Number(v.replace(',', '.'));
        const gc = num(goalCal);
        const gp = num(goalProt);
        const optional = (v: string) => (v.trim() === '' ? undefined : Math.round(num(v)));
        const gk = optional(goalCarb);
        const gf = optional(goalFat);
        const optOk = (v: number | undefined, max: number) => v === undefined || (Number.isFinite(v) && v >= 0 && v < max);
        if ([goalCal, goalProt, goalCarb, goalFat].every((v) => v.trim() === '')) await setGoals(null);
        else if (gc > 0 && gc < 10000 && gp > 0 && gp < 1000 && optOk(gk, 2000) && optOk(gf, 1000))
          await setGoals({ calories: Math.round(gc), proteinG: Math.round(gp), carbsG: gk, fatG: gf });
        else throw new UserError('Calories and protein must be positive numbers (carbs and fat are optional), or clear everything.');
      }
      router.back();
    } catch (e) {
      notifyError(e, 'Could not save', 'Could not save your settings. Please try again.');
    }
  };

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text }];
  const label = [styles.label, { color: t.textDim }];

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Text style={[styles.title, { color: t.text }]}>Meal settings</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={label}>DAILY GOALS</Text>
        <View style={styles.row}>
          <TextInput value={goalCal} onChangeText={setGoalCal} keyboardType="number-pad" placeholder="Calories" placeholderTextColor={t.textDim} style={[input, { flex: 1 }]} />
          <TextInput value={goalProt} onChangeText={setGoalProt} keyboardType="number-pad" placeholder="Protein (g)" placeholderTextColor={t.textDim} style={[input, { flex: 1 }]} />
        </View>
        <View style={styles.row}>
          <TextInput value={goalCarb} onChangeText={setGoalCarb} keyboardType="number-pad" placeholder="Carbs (g) · auto" placeholderTextColor={t.textDim} style={[input, { flex: 1 }]} />
          <TextInput value={goalFat} onChangeText={setGoalFat} keyboardType="number-pad" placeholder="Fat (g) · auto" placeholderTextColor={t.textDim} style={[input, { flex: 1 }]} />
        </View>
        <Text style={{ color: t.textDim, fontSize: 12, marginTop: 8 }}>
          Leave carbs and fat blank to split the calories left after protein (70 % carbs, 30 % fat).
        </Text>

        <Text style={[label, { marginTop: 28 }]}>GROQ · TRIED FIRST</Text>
        <TextInput
          value={groqKeyText}
          onChangeText={setGroqKeyText}
          placeholder={hasGroq ? '•••••••• (saved)' : 'API key'}
          placeholderTextColor={t.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={[input, { marginTop: 8 }]}
        />
        <TextInput
          value={groqModelText}
          onChangeText={setGroqModelText}
          placeholder={DEFAULT_GROQ_MODEL}
          placeholderTextColor={t.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          style={[input, { marginTop: 8 }]}
        />
        {hasGroq && (
          <Pressable onPress={async () => { await clearGroqKey().catch(onFail()); setHasGroq(false); }} hitSlop={8}>
            <Text style={[styles.remove, { color: t.danger }]}>Remove key</Text>
          </Pressable>
        )}

        <Text style={[label, { marginTop: 28 }]}>GEMINI · FALLBACK</Text>
        <TextInput
          value={keyText}
          onChangeText={setKeyText}
          placeholder={hasKey ? '•••••••• (saved)' : 'API key'}
          placeholderTextColor={t.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={[input, { marginTop: 8 }]}
        />
        <TextInput
          value={modelText}
          onChangeText={setModelText}
          placeholder={DEFAULT_MODEL}
          placeholderTextColor={t.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          style={[input, { marginTop: 8 }]}
        />
        {hasKey && (
          <Pressable onPress={async () => { await clearApiKey().catch(onFail()); setHasKey(false); }} hitSlop={8}>
            <Text style={[styles.remove, { color: t.danger }]}>Remove key</Text>
          </Pressable>
        )}

        <Text style={[label, { marginTop: 28 }]}>AI USAGE TODAY</Text>
        {(['groq', 'gemini'] as Provider[]).map((p) => {
          const u = usage?.[p] ?? { tokens: 0, requests: 0 };
          const lim = Number(limits[p].replace(/[,\s]/g, '')) || DEFAULT_LIMITS[p];
          const pct = (u.tokens / lim) * 100;
          return (
            <View key={p} style={{ marginTop: 12 }}>
              <View style={styles.usageHead}>
                <Text style={{ color: t.text, fontWeight: '600' }}>{p === 'groq' ? 'Groq' : 'Gemini'}</Text>
                <Text style={{ color: pct >= 90 ? t.danger : t.textDim, fontSize: 13 }}>
                  {pct < 10 ? pct.toFixed(1) : Math.round(pct)}% · {u.tokens.toLocaleString()} tokens · {u.requests} {u.requests === 1 ? 'call' : 'calls'}
                </Text>
              </View>
              <ProgressBar value={Math.min(1, u.tokens / lim)} height={6} color={pct >= 90 ? t.danger : t.success} />
              <TextInput
                value={limits[p]}
                onChangeText={(v) => setLimits((l) => ({ ...l, [p]: v }))}
                keyboardType="number-pad"
                placeholder="Daily token limit"
                placeholderTextColor={t.textDim}
                style={[input, { marginTop: 8 }]}
              />
            </View>
          );
        })}
        <Text style={{ color: t.textDim, fontSize: 12, marginTop: 8 }}>
          Counted on this device from each response (resets at midnight). Providers don’t report your remaining quota, so set the limit field to your plan’s daily token cap.
        </Text>

        <Text style={{ color: t.textDim, fontSize: 12, marginTop: 20 }}>
          Keys stay in the iOS Keychain on this device. Photos are sent to the provider for analysis.
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
  usageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  remove: { fontSize: 13, fontWeight: '600', marginTop: 10 },
});
