import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { notifyError } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { importHevyCsv } from '@/data/sqliteHevyImport';
import { defaultPlateConfig, type PlateConfig } from '@/domain/overload';
import { formatNumber, kgToUnit, parseWeightInput, type WeightUnit } from '@/domain/units';
import { useUnitStore } from '@/store/useUnitStore';
import { useWorkoutHistory } from '@/store/useWorkoutHistory';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { radius, useTheme } from '@/theme';

const fmtList = (kgs: number[], unit: WeightUnit) => kgs.map((k) => formatNumber(kgToUnit(k, unit), 2)).join(', ');

/** Parses "20, 10, 5, 2.5" typed in `unit` into kg values (heaviest first); null when nothing usable. */
function parsePlates(text: string, unit: WeightUnit): number[] | null {
  const vals = text
    .split(/[\s,;]+/)
    .map((p) => parseWeightInput(p, unit))
    .filter((v): v is number => v !== null && v > 0);
  return vals.length > 0 ? [...new Set(vals)].sort((a, b) => b - a) : null;
}

/** Weight unit and plate setup (used to round suggested and warm-up weights to what can be loaded). */
export default function WorkoutSettings() {
  const t = useTheme();
  const { unit, plates, warmupVolume, setUnit, setPlates, setWarmupVolume } = useUnitStore();
  const [barText, setBarText] = useState(formatNumber(kgToUnit(plates.barKg, unit), 2));
  const [platesText, setPlatesText] = useState(fmtList(plates.platesKg, unit));

  const syncFields = (c: PlateConfig, u: WeightUnit) => {
    setBarText(formatNumber(kgToUnit(c.barKg, u), 2));
    setPlatesText(fmtList(c.platesKg, u));
  };

  const changeUnit = async (u: WeightUnit) => {
    try {
      await setUnit(u);
      syncFields(useUnitStore.getState().plates, u);
    } catch (e) {
      notifyError(e, 'Could not change unit');
    }
  };

  const [importing, setImporting] = useState(false);
  const importHevy = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets?.[0]) return;
      setImporting(true);
      const text = await new File(picked.assets[0].uri).text();
      const r = await importHevyCsv(text);
      await Promise.all([useWorkoutLibraryStore.getState().load(), useWorkoutHistory.getState().load()]);
      Alert.alert(
        'Hevy import done',
        `${r.workouts} workout${r.workouts === 1 ? '' : 's'} added` +
          (r.alreadyThere ? ` (${r.alreadyThere} already imported)` : '') +
          `, ${r.templates} template${r.templates === 1 ? '' : 's'} created, ${r.exercises} custom exercise${r.exercises === 1 ? '' : 's'} added.`,
      );
    } catch (e) {
      notifyError(e, 'Could not import', 'That file could not be imported. Pick the workout_data.csv exported from Hevy.');
    } finally {
      setImporting(false);
    }
  };

  const bar = parseWeightInput(barText, unit);
  const list = parsePlates(platesText, unit);
  const valid = bar !== null && bar > 0 && list !== null;

  const save = async () => {
    if (!valid) return;
    try {
      await setPlates({ barKg: bar, platesKg: list });
      router.back();
    } catch (e) {
      notifyError(e, 'Could not save');
    }
  };

  const reset = async () => {
    const c = defaultPlateConfig(unit);
    syncFields(c, unit);
    try {
      await setPlates(c);
    } catch (e) {
      notifyError(e, 'Could not save');
    }
  };

  const input = [styles.input, { backgroundColor: t.surface, borderColor: t.border, color: t.text }];

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Text style={[styles.heading, { color: t.text }]}>Workout settings</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>Close</Text>
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: t.textDim }]}>Weight unit</Text>
        <Segmented
          options={[
            { value: 'kg', label: 'Kilograms' },
            { value: 'lb', label: 'Pounds' },
          ]}
          value={unit}
          onChange={changeUnit}
        />
        <Text style={{ color: t.textDim, fontSize: 12 }}>Everything is stored in kg; this only changes how weights are shown and typed (workouts and body weight).</Text>

        <View style={[styles.switchRow, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Count warm-up sets in volume</Text>
            <Text style={{ color: t.textDim, fontSize: 12, marginTop: 2 }}>Off by default. Warm-ups never count toward personal records.</Text>
          </View>
          <Switch value={warmupVolume} onValueChange={(v) => setWarmupVolume(v).catch((e) => notifyError(e, 'Could not save'))} trackColor={{ true: t.accent }} />
        </View>

        <Text style={[styles.label, { color: t.textDim }]}>Empty bar ({unit})</Text>
        <TextInput value={barText} onChangeText={setBarText} keyboardType="decimal-pad" style={input} />

        <Text style={[styles.label, { color: t.textDim }]}>Plates you have ({unit}, one per size)</Text>
        <TextInput value={platesText} onChangeText={setPlatesText} placeholder="25, 20, 15, 10, 5, 2.5, 1.25" placeholderTextColor={t.textDim} style={input} />
        <Text style={{ color: t.textDim, fontSize: 12, marginTop: 6 }}>
          Plates load in pairs, so the smallest jump is twice the lightest plate. Suggested and warm-up weights are rounded to what you can load.
        </Text>

        <Pressable onPress={reset} style={{ marginTop: 16 }}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>Reset to standard {unit} plates</Text>
        </Pressable>

        <Text style={[styles.label, { color: t.textDim }]}>Import from Hevy</Text>
        <Pressable
          disabled={importing}
          onPress={importHevy}
          style={[styles.switchRow, { backgroundColor: t.surface, borderColor: t.border, marginTop: 0, opacity: importing ? 0.6 : 1 }]}
          accessibilityRole="button"
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{importing ? 'Importing…' : 'Import Hevy CSV'}</Text>
            <Text style={{ color: t.textDim, fontSize: 12, marginTop: 2 }}>
              Adds your logged workouts to History and makes a template from each workout name you repeat. Safe to run again: nothing is added twice.
            </Text>
          </View>
          {importing && <ActivityIndicator color={t.accent} />}
        </Pressable>
      </ScrollView>
      <Pressable disabled={!valid} onPress={save} style={[styles.cta, { backgroundColor: t.accent, opacity: valid ? 1 : 0.4 }]}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Save plates</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  heading: { fontSize: 24, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 14, fontSize: 17 },
  switchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: 14, marginTop: 18 },
  cta: { alignItems: 'center', paddingVertical: 16, borderRadius: radius.lg, marginTop: 8 },
});
