import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { notifyError, onFail } from '@/components/notify';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { maskKey } from '@/domain/apiKey';
import {
  clearApiKey,
  clearGroqKey,
  getApiKey,
  getGroqKey,
  getGroqModel,
  getModel,
  setApiKey,
  setGroqKey,
  setGroqModel,
  setModel,
  testProvider,
  type ProviderCheck,
} from '@/services/mealAnalyzer';
import { DEFAULT_GROQ_MODEL, DEFAULT_MODEL } from '@/services/mealAnalyzerConstants';
import { DEFAULT_LIMITS, getLimit, getUsageToday, setLimit, type Provider, type Usage } from '@/services/aiUsage';
import { radius, useTheme } from '@/theme';

export default function AiSettingsScreen() {
  const t = useTheme();

  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [savedGroq, setSavedGroq] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<Provider, boolean>>({ groq: false, gemini: false });
  const [tests, setTests] = useState<Partial<Record<Provider, ProviderCheck[] | 'running'>>>({});
  const [keyText, setKeyText] = useState('');
  const [modelText, setModelText] = useState(DEFAULT_MODEL);
  const [groqKeyText, setGroqKeyText] = useState('');
  const [groqModelText, setGroqModelText] = useState(DEFAULT_GROQ_MODEL);
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
    getApiKey().then(setSavedKey).catch(() => {});
    getGroqKey().then(setSavedGroq).catch(() => {});
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
      router.back();
    } catch (e) {
      notifyError(e, 'Could not save', 'Could not save your settings. Please try again.');
    }
  };

  const runTest = async (p: Provider) => {
    setTests((x) => ({ ...x, [p]: 'running' }));
    try {
      const checks = await testProvider(p, {
        key: p === 'groq' ? groqKeyText : keyText,
        model: p === 'groq' ? groqModelText : modelText,
      });
      setTests((x) => ({ ...x, [p]: checks }));
    } catch (e) {
      setTests((x) => ({ ...x, [p]: [{ label: 'Text', ok: false, detail: e instanceof Error ? e.message : String(e) }] }));
    }
    getUsageToday().then(setUsage).catch(() => {});
  };

  const keyPanel = (p: Provider, saved: string | null, onRemove: () => void) => {
    const result = tests[p];
    return (
      <View style={{ marginTop: 10 }}>
        {saved ? (
          <View style={styles.usageHead}>
            <Text selectable style={{ color: t.text, fontSize: 13, flex: 1, marginRight: 12 }}>
              Saved: {maskKey(saved, revealed[p])}
            </Text>
            <Pressable onPress={() => setRevealed((r) => ({ ...r, [p]: !r[p] }))} hitSlop={8}>
              <Text style={{ color: t.accent, fontWeight: '600', fontSize: 13 }}>{revealed[p] ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={{ color: t.textDim, fontSize: 13 }}>No key saved</Text>
        )}
        <View style={[styles.usageHead, { marginTop: 10, marginBottom: 0 }]}>
          <Pressable
            onPress={() => runTest(p)}
            disabled={result === 'running'}
            style={[styles.testBtn, { borderColor: t.accent, opacity: result === 'running' ? 0.5 : 1 }]}
          >
            <Text style={{ color: t.accent, fontWeight: '600', fontSize: 13 }}>{result === 'running' ? 'Testing…' : 'Test'}</Text>
          </Pressable>
          {saved && (
            <Pressable onPress={onRemove} hitSlop={8}>
              <Text style={[styles.remove, { color: t.danger, marginTop: 0 }]}>Remove key</Text>
            </Pressable>
          )}
        </View>
        {Array.isArray(result) &&
          result.map((c) => (
            <Text key={c.label} selectable style={{ color: c.ok ? t.success : t.danger, fontSize: 12, marginTop: 6 }}>
              {c.ok ? '✓' : '✗'} {c.label}: {c.detail}
            </Text>
          ))}
      </View>
    );
  };

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text }];
  const label = [styles.label, { color: t.textDim }];

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Text style={[styles.title, { color: t.text }]}>AI settings</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Pressable
          onPress={() => router.push('/memory' as Href)}
          style={[styles.link, { backgroundColor: t.surfaceAlt }]}
          accessibilityLabel="Assistant memory"
        >
          <Ionicons name="sparkles-outline" size={18} color={t.accent} />
          <Text style={{ color: t.text, fontWeight: '600', flex: 1 }}>Assistant memory</Text>
          <Ionicons name="chevron-forward" size={18} color={t.textDim} />
        </Pressable>
        <Text style={{ color: t.textDim, fontSize: 12, marginTop: 8 }}>
          One set of keys powers meal analysis, voice and your personal assistant.
        </Text>

        <Text style={[label, { marginTop: 28 }]}>GROQ · TRIED FIRST</Text>
        <TextInput
          value={groqKeyText}
          onChangeText={setGroqKeyText}
          placeholder={savedGroq ? '•••••••• (saved) — type to replace' : 'API key'}
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
        {keyPanel('groq', savedGroq, async () => {
          await clearGroqKey().catch(onFail());
          setSavedGroq(null);
        })}

        <Text style={[label, { marginTop: 28 }]}>GEMINI · FALLBACK</Text>
        <TextInput
          value={keyText}
          onChangeText={setKeyText}
          placeholder={savedKey ? '•••••••• (saved) — type to replace' : 'API key'}
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
        {keyPanel('gemini', savedKey, async () => {
          await clearApiKey().catch(onFail());
          setSavedKey(null);
        })}

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
  testBtn: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 8 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 14 },
  remove: { fontSize: 13, fontWeight: '600', marginTop: 10 },
});
