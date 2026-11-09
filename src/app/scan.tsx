import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { InlineNotice } from '@/components/InlineNotice';
import { MicButton } from '@/components/MicButton';
import { notifyError } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { dateParam, dayTitle, todayKey } from '@/domain/date';
import { friendlyError } from '@/domain/errors';
import { foodTitle, scaleFood, type Food } from '@/domain/food';
import { isMealSlot, slotForTime, slotLabel, totalsOf, type Meal } from '@/domain/meal';
import { sqliteFoodCacheRepo } from '@/data/sqliteRepository';
import { guessUnitGrams } from '@/domain/unitWeights';
import { mergeTranscript } from '@/domain/voice';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { barcodeCandidates, lookupBarcode, RequestCancelled, searchFoods } from '@/services/openFoodFacts';
import { useMealDraft } from '@/store/useMealDraft';
import { useMealStore } from '@/store/useMealStore';
import { radius, useTheme } from '@/theme';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const parse = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

type Mode = 'scan' | 'search';

const DEBOUNCE_MS = 400;
const NO_MATCH = 'No matches with nutrition data. Try other words, or scan the barcode.';

export default function ScanScreen() {
  const t = useTheme();
  const { add, saveTemplate } = useMealStore();
  const [perm, requestPerm] = useCameraPermissions();
  const locked = useRef(false);
  const params = useLocalSearchParams<{ slot?: string | string[]; mode?: string | string[]; target?: string | string[]; date?: string | string[] }>();
  const date = dateParam(params.date);
  const slotParam = Array.isArray(params.slot) ? params.slot[0] : params.slot;
  // target=builder: the food is added to the meal being built instead of being logged.
  const toBuilder = (Array.isArray(params.target) ? params.target[0] : params.target) === 'builder';
  const [slot] = useState(() => (isMealSlot(slotParam) ? slotParam : slotForTime(new Date())));

  // Photo / Library / Search / Scan are separate entry points; the route decides which this screen is.
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const [mode] = useState<Mode>(modeParam === 'search' ? 'search' : 'scan');
  const [manual, setManual] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null); // guidance (not a failure)
  const [error, setError] = useState<string | null>(null); // a lookup/search that failed
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = useRef<TextInputInstance>(null);
  const cacheRef = useRef(new Map<string, Food[]>());

  // selected food + editable values (strings so partial typing works)
  const [food, setFood] = useState<Food | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [prot, setProt] = useState('');
  const [carb, setCarb] = useState('');
  const [fat, setFat] = useState('');
  const [grams, setGrams] = useState('');
  const [units, setUnits] = useState('');
  const [unitW, setUnitW] = useState(''); // suggested grams per unit for plain whole foods when the product lists no pack/serving

  const select = (f: Food, cached = false, note: string | null = null) => {
    setFood(f);
    setFromCache(cached);
    setName(foodTitle(f));
    setKcal(fmt(f.kcal100));
    setProt(fmt(f.protein100));
    setCarb(fmt(f.carbs100));
    setFat(fmt(f.fat100));
    const known = f.packG ?? f.servingG;
    const guess = known ? null : guessUnitGrams(f.name);
    setUnitW(guess ? fmt(guess) : '');
    setGrams(fmt(known ?? guess ?? 100));
    setUnits(known || guess ? '1' : '');
    setNotice(note);
  };

  const blank = (barcode: string, nm: string, packG: number | null): Food => ({
    barcode,
    name: nm,
    brand: '',
    kcal100: 0,
    protein100: 0,
    carbs100: 0,
    fat100: 0,
    packG,
    servingG: null,
  });

  const resolve = async (code: string) => {
    const clean = code.replace(/\D/g, '');
    if (clean.length < 8) {
      setNotice('Enter a full barcode (8–14 digits).');
      locked.current = false;
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      for (const c of barcodeCandidates(clean)) {
        const hit = await sqliteFoodCacheRepo.get(c);
        if (hit) {
          select(hit, true);
          return;
        }
      }
      const r = await lookupBarcode(clean);
      if (r.kind === 'found') {
        select(
          r.food,
          false,
          r.food.prepared
            ? 'Only “as prepared” values were listed — check them against the pack (dry powders differ).'
            : null,
        );
      } else if (r.kind === 'incomplete') {
        select(
          blank(r.barcode, [r.brand, r.name].filter(Boolean).join(' '), r.packG),
          false,
          'Found in Open Food Facts but without nutrition. Enter the values from the pack label (per 100 g).',
        );
      } else {
        select(blank(barcodeCandidates(clean)[0], '', null), false, 'Not in Open Food Facts. Enter the label values (per 100 g) once — it’s remembered for next time.');
      }
    } catch (e) {
      console.warn('Barcode lookup failed', e);
      setError(friendlyError(e, 'Could not look that up. Please try again.'));
      locked.current = false;
    } finally {
      setBusy(false);
    }
  };

  const runSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      abortRef.current = null;
      setResults(null);
      setSearching(false);
      setNotice(null);
      setError(null);
      return;
    }
    const key = trimmed.toLowerCase();
    const cached = cacheRef.current.get(key);
    if (cached) {
      abortRef.current = null;
      setResults(cached);
      setNotice(cached.length === 0 ? NO_MATCH : null);
      setError(null);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);
    setNotice(null);
    setError(null);
    try {
      const r = await searchFoods(trimmed, 12, ctrl.signal);
      if (abortRef.current !== ctrl) return; // superseded by a newer query: never show stale hits
      cacheRef.current.set(key, r);
      setResults(r); // previous results stay visible until these arrive
      setNotice(r.length === 0 ? NO_MATCH : null);
    } catch (e) {
      if (e instanceof RequestCancelled || abortRef.current !== ctrl) return;
      console.warn('Food search failed', e);
      setError(friendlyError(e, 'Search failed. Please try again.'));
    } finally {
      if (abortRef.current === ctrl) setSearching(false);
    }
  }, []);

  // Search-as-you-type: debounce keystrokes, cancel superseded requests.
  useEffect(() => {
    if (mode !== 'search') return;
    timerRef.current = setTimeout(() => runSearch(query), query.trim().length < 2 ? 0 : DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, mode, runSearch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const submitSearch = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Keyboard.dismiss();
    runSearch(query);
  };

  const reset = () => {
    locked.current = false;
    setFood(null);
    setNotice(null);
    setError(null);
    setManual('');
  };

  // Parsed, validated current values
  const g = parse(grams);
  const vals = {
    kcal: parse(kcal),
    prot: parse(prot),
    carb: parse(carb),
    fat: parse(fat),
  };
  const valid =
    !!food &&
    name.trim() !== '' &&
    Number.isFinite(g) &&
    g > 0 &&
    g <= 5000 &&
    [vals.kcal, vals.prot, vals.carb, vals.fat].every(Number.isFinite) &&
    vals.kcal <= 950; // > ~900 kcal/100 g (pure fat) is almost certainly a typo

  // 1 unit = one pack (or one serving if the pack weight is unknown); null → no unit input
  const customW = parse(unitW);
  const unitG = food ? (food.packG ?? food.servingG ?? (Number.isFinite(customW) && customW > 0 ? customW : null)) : null;
  const unitKnown = !!food && (food.packG ?? food.servingG) != null;
  const unitFmt = (n: number) => String(Math.round(n * 100) / 100);
  const onGrams = (v: string) => {
    setGrams(v);
    const n = parse(v);
    if (unitG) setUnits(Number.isFinite(n) ? unitFmt(n / unitG) : '');
  };
  const onUnits = (v: string) => {
    setUnits(v);
    const n = parse(v);
    if (unitG && Number.isFinite(n)) setGrams(fmt(n * unitG));
  };

  const current: Food | null = food
    ? {
        ...food,
        name: name.trim(),
        brand: '', // brand is already folded into the editable name
        kcal100: vals.kcal,
        protein100: vals.prot,
        carbs100: vals.carb,
        fat100: vals.fat,
        packG: food.packG,
        servingG: food.servingG ?? (!unitKnown && unitG ? unitG : null), // remember my unit size for next time
      }
    : null;
  const ing = current && valid ? scaleFood(current, g) : null;
  const tot = ing ? totalsOf([ing]) : null;

  const addToBuilder = async () => {
    if (!current || !ing) return;
    try {
      if (current.barcode) await sqliteFoodCacheRepo.put(current);
      useMealDraft.getState().add(ing);
      router.back();
    } catch (e) {
      notifyError(e, 'Could not add', 'Could not add this food. Please try again.');
    }
  };

  const log = async (alsoFavorite: boolean) => {
    if (!current || !ing || !tot) return;
    try {
      const meal: Meal = {
        id: newId(),
        date,
        slot,
        loggedAt: new Date().toISOString(),
        title: ing.name,
        inputType: 'database',
        confidence: 10,
        ingredients: [ing],
        calories: tot.calories,
        proteinG: tot.proteinG,
        carbsG: tot.carbsG,
        fatG: tot.fatG,
        assumptions: [
          fromCache
            ? `Saved per-100 g label values scaled to ${fmt(g)} g.`
            : `Per-100 g label values (Open Food Facts or typed from the pack) scaled to ${fmt(g)} g.`,
        ],
      };
      await add(meal);
      if (current.barcode) await sqliteFoodCacheRepo.put(current);
      if (alsoFavorite) {
        await saveTemplate({
          id: newId(),
          title: ing.name,
          ingredients: [ing],
          calories: tot.calories,
          proteinG: tot.proteinG,
          carbsG: tot.carbsG,
          fatG: tot.fatG,
          createdAt: new Date().toISOString(),
        });
      }
      router.dismissTo('/(tabs)/meals' as Href); // land on the Meals tab with the day updated
    } catch (e) {
      notifyError(e, 'Could not log', 'Could not log this food. Please try again.');
    }
  };

  const voice = useVoiceInput(
    (spoken) => setQuery(mergeTranscript('', spoken)),
    (e) => setError(friendlyError(e, 'Voice input failed. Please try again.')),
  );

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text }];
  const card = [styles.card, { backgroundColor: t.surface, borderColor: t.border }];

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Text style={[styles.title, { color: t.text }]}>{food ? (toBuilder ? 'Add to meal' : 'Log food') : mode === 'search' ? 'Search food' : 'Scan barcode'}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>Close</Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {!food && (
          <>
            {mode === 'scan' && (
              <>
                {!perm ? null : !perm.granted ? (
                  <View style={card}>
                    <Text style={{ color: t.text }}>Camera access is needed to scan barcodes.</Text>
                    <Pressable onPress={requestPerm} style={[styles.btn, { backgroundColor: t.accent, marginTop: 10 }]}>
                      <Text style={styles.btnText}>Allow camera</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.camWrap}>
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                      onBarcodeScanned={({ data }) => {
                        if (locked.current || busy) return; // the callback fires repeatedly
                        locked.current = true;
                        resolve(data);
                      }}
                    />
                    <View pointerEvents="none" style={[styles.reticle, { borderColor: t.success }]} />
                  </View>
                )}
                <Text style={{ color: t.textDim, fontSize: 12, marginTop: 8 }}>Point at the barcode, or type it:</Text>
                <View style={styles.row}>
                  <TextInput
                    value={manual}
                    onChangeText={setManual}
                    keyboardType="number-pad"
                    placeholder="Barcode digits"
                    placeholderTextColor={t.textDim}
                    style={[input, { flex: 1 }]}
                    returnKeyType="search"
                    onSubmitEditing={() => resolve(manual)}
                  />
                  <Pressable onPress={() => resolve(manual)} style={[styles.btn, { backgroundColor: t.accent }]}>
                    <Text style={styles.btnText}>Look up</Text>
                  </Pressable>
                </View>
              </>
            )}

            {mode === 'search' && (
              <>
                <View style={styles.row}>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <TextInput
                      ref={queryRef}
                      value={query}
                      onChangeText={setQuery}
                      placeholder="e.g. amul paneer"
                      placeholderTextColor={t.textDim}
                      autoCorrect={false}
                      autoFocus
                      style={[input, query.length > 0 && { paddingRight: 36 }]}
                      returnKeyType="search"
                      onSubmitEditing={submitSearch}
                    />
                    {query.length > 0 && (
                      <Pressable
                        onPress={() => {
                          setQuery(''); // search field only — never touches the meal prompt box
                          queryRef.current?.focus();
                        }}
                        hitSlop={10}
                        style={{ position: 'absolute', right: 10 }}
                        accessibilityLabel="Clear search"
                      >
                        <Ionicons name="close-circle" size={18} color={t.textDim} />
                      </Pressable>
                    )}
                  </View>
                  <MicButton state={voice.state} onPress={voice.toggle} size={44} />
                  <Pressable onPress={submitSearch} style={[styles.btn, { backgroundColor: t.accent }]}>
                    <Text style={styles.btnText}>Search</Text>
                  </Pressable>
                </View>
                {searching && <ActivityIndicator style={{ marginTop: 12 }} color={t.accent} />}
                {results?.map((f, i) => (
                  <Pressable
                    key={`${f.barcode}-${i}`}
                    onPress={() => select(f)}
                    style={[styles.hit, { backgroundColor: t.surface, borderColor: t.border, opacity: searching ? 0.5 : 1 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontSize: 15 }} numberOfLines={2}>
                        {foodTitle(f)}
                      </Text>
                      <Text style={{ color: t.textDim, fontSize: 12 }}>
                        per 100 g: {fmt(f.kcal100)} kcal · {fmt(f.protein100)} g P{f.packG ? ` · pack ${fmt(f.packG)} g` : ''}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {busy && <ActivityIndicator style={{ marginTop: 16 }} color={t.accent} />}
            {error && (
              <InlineNotice
                message={error}
                actionLabel={mode === 'search' && query.trim().length >= 2 ? 'Retry' : undefined}
                onAction={submitSearch}
                onDismiss={() => setError(null)}
              />
            )}
            {notice && !error && <InlineNotice tone="info" message={notice} />}
          </>
        )}

        {food && (
          <View style={card}>
            {notice && <InlineNotice tone="info" message={notice} />}
            {fromCache && <Text style={{ color: t.textDim, fontSize: 12, marginBottom: 8 }}>Using values you saved for this barcode.</Text>}
            <TextInput value={name} onChangeText={setName} placeholder="Food name" placeholderTextColor={t.textDim} style={input} />

            <Text style={[styles.label, { color: t.textDim }]}>Label values per 100 g</Text>
            <View style={[styles.row, styles.rowAfterLabel]}>
              <Field t={t} label="kcal" value={kcal} onChange={setKcal} />
              <Field t={t} label="Protein g" value={prot} onChange={setProt} />
              <Field t={t} label="Carbs g" value={carb} onChange={setCarb} />
              <Field t={t} label="Fat g" value={fat} onChange={setFat} />
            </View>

            <Text style={[styles.label, { color: t.textDim }]}>How much did you eat? (g)</Text>
            <TextInput value={grams} onChangeText={onGrams} keyboardType="decimal-pad" style={input} />
            {unitG ? (
              <>
                <Text style={[styles.label, { color: t.textDim }]}>
                  Number of units (1 unit = {fmt(unitG)} g)
                </Text>
                <TextInput value={units} onChangeText={onUnits} keyboardType="decimal-pad" placeholder="1" placeholderTextColor={t.textDim} style={input} />
              </>
            ) : null}
            <View style={styles.row}>
              {food.packG ? <Chip t={t} label={`Whole pack ${fmt(food.packG)} g`} onPress={() => onGrams(fmt(food.packG!))} /> : null}
              {food.servingG ? <Chip t={t} label={`1 serving ${fmt(food.servingG)} g`} onPress={() => onGrams(fmt(food.servingG!))} /> : null}
              <Chip t={t} label="100 g" onPress={() => onGrams('100')} />
            </View>
            {!food.packG && <Text style={{ color: t.textDim, fontSize: 11, marginTop: 6 }}>Pack weight isn’t listed — read it off the pack and type it above.</Text>}

            <Text style={{ color: t.text, fontSize: 18, fontWeight: '800', marginTop: 14 }}>
              {tot ? `${tot.calories} kcal · ${tot.proteinG} g protein` : 'Enter valid numbers'}
            </Text>
            {tot && (
              <Text style={{ color: t.textDim, fontSize: 12, marginTop: 2 }}>
                Carbs {tot.carbsG} g · Fat {tot.fatG} g
              </Text>
            )}
            {vals.kcal === 0 && Number.isFinite(vals.kcal) && (
              <Text style={{ color: t.danger, fontSize: 12, marginTop: 6 }}>Calories are 0 — fill in the label values first.</Text>
            )}

            {toBuilder ? (
              <Pressable
                disabled={!valid}
                onPress={addToBuilder}
                style={[styles.btn, { backgroundColor: t.success, opacity: valid ? 1 : 0.4, marginTop: 14 }]}
              >
                <Text style={{ color: '#06231B', fontWeight: '800' }}>Add to meal</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  disabled={!valid}
                  onPress={() => log(false)}
                  style={[styles.btn, { backgroundColor: t.success, opacity: valid ? 1 : 0.4, marginTop: 14 }]}
                >
                  <Text style={{ color: '#06231B', fontWeight: '800' }}>Log to {slotLabel(slot)}{date !== todayKey() ? ` · ${dayTitle(date)}` : ''}</Text>
                </Pressable>
                <Pressable
                  disabled={!valid}
                  onPress={() => log(true)}
                  style={[styles.btn, { backgroundColor: t.surfaceAlt, opacity: valid ? 1 : 0.4, marginTop: 8 }]}
                >
                  <Text style={{ color: t.accent, fontWeight: '700' }}>Log & save as favorite</Text>
                </Pressable>
              </>
            )}
            <Pressable onPress={reset} style={[styles.btn, { marginTop: 4 }]}>
              <Text style={{ color: t.textDim, fontWeight: '600' }}>Scan another</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function Field({
  t,
  label,
  value,
  onChange,
}: {
  t: ReturnType<typeof useTheme>;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        style={[styles.input, { backgroundColor: t.surfaceAlt, color: t.text, paddingHorizontal: 8, textAlign: 'center' }]}
      />
      <Text style={{ color: t.textDim, fontSize: 10, textAlign: 'center', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Chip({ t, label, onPress }: { t: ReturnType<typeof useTheme>; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: t.accentSoft }]}>
      <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  camWrap: { height: 260, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  reticle: { width: '78%', height: 110, borderWidth: 2, borderRadius: radius.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  input: { borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  btn: { borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: radius.md, padding: 16, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  rowAfterLabel: { marginTop: 0 },
  hit: { borderWidth: 1, borderRadius: radius.md, padding: 12, marginTop: 8 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
});
