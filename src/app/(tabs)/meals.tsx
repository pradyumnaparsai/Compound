import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { addDays, todayKey } from '@/domain/date';
import {
  dayTotals,
  macroGoals,
  MEAL_SLOTS,
  slotForTime,
  slotLabel,
  totalsOf,
  type Ingredient,
  type Meal,
  type MealAnalysis,
  type MealSlot,
  type SavedMeal,
} from '@/domain/meal';
import { AnalysisCancelled, analyzeMeal, getApiKey, getGroqKey } from '@/services/mealAnalyzer';
import { deletePending, listPending, pendingBase64, savePending, type PendingMeal } from '@/services/pendingMeals';
import { useMealStore } from '@/store/useMealStore';
import { radius, useTheme, type Theme } from '@/theme';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const done = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
const fmtN = (n: number) => Math.round(n * 10) / 10;

type Photo = { uri: string; base64: string; mimeType: string };

export default function MealsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { meals, saved, goals, add, saveTemplate, removeTemplate } = useMealStore();
  const today = todayKey();
  const todays = useMemo(() => meals.filter((m) => m.date === today), [meals, today]);
  const totals = dayTotals(todays);
  const targets = goals ? macroGoals(goals) : null;
  const weekAvg = useMemo(() => {
    const from = addDays(today, -7);
    const past = meals.filter((m) => m.date >= from && m.date < today);
    const days = new Set(past.map((m) => m.date)).size;
    return days ? Math.round(past.reduce((a, m) => a + m.calories, 0) / days) : null;
  }, [meals, today]);

  const [hasAiKey, setHasAiKey] = useState<boolean | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [viewPhoto, setViewPhoto] = useState(false);
  // Durable copy of the current photo while it awaits analysis. `fromPending`: the preview IS that file, so keep it until saved/removed.
  const [cur, setCur] = useState<{ id: string; fromPending: boolean } | null>(null);
  const [pendingList, setPendingList] = useState<PendingMeal[]>([]);
  // A retried photo is logged under the slot/day it was taken, not whenever the retry succeeds.
  const [logAs, setLogAs] = useState<{ slot: MealSlot; date: string } | null>(null);
  const refreshPending = () => setPendingList(listPending());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [draft, setDraft] = useState<MealAnalysis | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  // A manual pick sticks only while the time-based default hasn't moved on (the tab stays mounted all day).
  const [slotPick, setSlotPick] = useState<{ slot: MealSlot; auto: MealSlot } | null>(null);
  const autoSlot = slotForTime(new Date());
  const slot = slotPick && slotPick.auto === autoSlot ? slotPick.slot : autoSlot;
  const setSlot = (s: MealSlot) => setSlotPick({ slot: s, auto: autoSlot });
  // Re-check keys whenever the tab regains focus (they're edited in the settings modal).
  useFocusEffect(
    useCallback(() => {
      Promise.all([getApiKey(), getGroqKey()])
        .then(([a, b]) => setHasAiKey(!!a || !!b))
        .catch(() => setHasAiKey(false));
      setPendingList(listPending());
    }, []),
  );

  const pick = async (source: 'camera' | 'library') => {
    tap();
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow access in Settings → Compound.');
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true };
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync(opts);
      const a = !res.canceled ? res.assets[0] : null;
      if (a?.base64) {
        // base64 output is always JPEG per the picker docs
        setPhoto({ uri: a.uri, base64: a.base64, mimeType: 'image/jpeg' });
        setCur(null);
        setLogAs(null);
        setDraft(null);
        setError(null);
      }
    } catch (e) {
      Alert.alert('Photo failed', e instanceof Error ? e.message : String(e));
    }
  };

  const canAnalyze = busy || !!photo || note.trim() !== '';

  useEffect(() => () => abortRef.current?.abort(), []);

  const cancelAnalyze = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setError(null);
  };

  /** Drops the current photo and its durable copy (the user is done with it). */
  const clearPhoto = () => {
    if (cur) deletePending(cur.id);
    setCur(null);
    setLogAs(null);
    setPhoto(null);
    refreshPending();
  };

  const loadPending = async (p: PendingMeal) => {
    if (busy) return;
    tap();
    try {
      const base64 = await pendingBase64(p.uri);
      setPhoto({ uri: p.uri, base64, mimeType: p.mimeType });
      setCur({ id: p.id, fromPending: true });
      setNote(p.note);
      setSlotPick({ slot: p.slot, auto: autoSlot });
      setLogAs({ slot: p.slot, date: p.date });
      setDraft(null);
      setError(null);
    } catch {
      deletePending(p.id);
      Alert.alert('Photo unavailable', 'The saved photo could not be read and was removed.');
    }
    refreshPending();
  };

  const dropPending = (p: PendingMeal) =>
    Alert.alert('Delete saved photo?', 'It will not be analysed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deletePending(p.id);
          refreshPending();
        },
      },
    ]);

  const analyze = async () => {
    if (busy) {
      tap();
      cancelAnalyze();
      return;
    }
    Keyboard.dismiss();
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError(null);
    setDraft(null);
    // Persist first: a 503/429 retry chain can take minutes and the app may be killed meanwhile.
    let pendingId = cur?.id ?? null;
    const fromPending = cur?.fromPending ?? false;
    if (photo && !pendingId) {
      try {
        pendingId = savePending(photo.uri, { note, slot, date: today, mimeType: photo.mimeType }).id;
        setCur({ id: pendingId, fromPending: false });
        refreshPending();
      } catch (e) {
        console.error(e);
      }
    }
    try {
      const r = await analyzeMeal({ imageBase64: photo?.base64, mimeType: photo?.mimeType, note, signal: ctrl.signal });
      if (abortRef.current !== ctrl) return;
      if (pendingId && !fromPending) {
        deletePending(pendingId);
        setCur(null);
        refreshPending();
      }
      setDraft(r);
      setUsedModel(r.model);
      setTitle(r.ingredients[0]?.name ?? 'Meal');
      setEditing(null);
      setShowDetails(false);
    } catch (e) {
      if (e instanceof AnalysisCancelled || abortRef.current !== ctrl) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(pendingId ? `${msg} — photo saved, retry anytime.` : msg);
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const editIngredient = (i: number, patch: Partial<Ingredient>) =>
    setDraft((d) => d && { ...d, ingredients: d.ingredients.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const dropIngredient = (i: number) => {
    setEditing(null);
    setDraft((d) => d && { ...d, ingredients: d.ingredients.filter((_, j) => j !== i) });
  };

  const draftTotals = draft ? totalsOf(draft.ingredients) : null;

  const toMeal = (
    name: string,
    inputType: Meal['inputType'],
    confidence: number,
    ingredients: Ingredient[],
    assumptions: string[],
    mealSlot: MealSlot = slot,
  ): Meal => {
    const tt = totalsOf(ingredients);
    return {
      id: newId(),
      date: today,
      slot: mealSlot,
      loggedAt: new Date().toISOString(),
      title: name.trim() || 'Meal',
      inputType,
      confidence,
      ingredients,
      calories: tt.calories,
      proteinG: tt.proteinG,
      carbsG: tt.carbsG,
      fatG: tt.fatG,
      assumptions,
    };
  };

  const toTemplate = (name: string, ingredients: Ingredient[]): SavedMeal => {
    const tt = totalsOf(ingredients);
    return {
      id: newId(),
      title: name.trim() || 'Meal',
      ingredients,
      calories: tt.calories,
      proteinG: tt.proteinG,
      carbsG: tt.carbsG,
      fatG: tt.fatG,
      createdAt: new Date().toISOString(),
    };
  };

  const save = async () => {
    if (!draft || draft.ingredients.length === 0) return;
    try {
      const m = toMeal(title, draft.input_type, draft.meal_confidence_score, draft.ingredients, draft.assumptions_made, logAs?.slot);
      await add(logAs ? { ...m, date: logAs.date } : m);
      done();
      setDraft(null);
      clearPhoto();
      setNote('');
    } catch (e) {
      console.error(e);
    }
  };

  const saveDraftAsFavorite = async () => {
    if (!draft || draft.ingredients.length === 0) return;
    try {
      await saveTemplate(toTemplate(title, draft.ingredients));
      tap();
      Alert.alert('Saved', `“${title.trim() || 'Meal'}” is in your quick-log chips.`);
    } catch (e) {
      console.error(e);
    }
  };

  const logSaved = (m: SavedMeal) => {
    done();
    add(toMeal(m.title, 'saved', 10, m.ingredients, ['Logged from a saved meal.'])).catch(console.error);
  };

  const input = [styles.input, { backgroundColor: t.surfaceAlt, color: t.text }];

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.text }]}>Meals</Text>
          <Pressable
            onPress={() => router.push('/meal-settings' as Href)}
            hitSlop={12}
            style={[styles.iconBtn, { backgroundColor: t.surfaceAlt }]}
            accessibilityLabel="Meal settings"
          >
            <Ionicons name="settings-outline" size={18} color={t.text} />
          </Pressable>
        </View>

        {/* Summary */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardLabel, { color: t.textDim }]}>Calories</Text>
          <View style={styles.calRow}>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', flexShrink: 1 }}>
              {totals.calories.toLocaleString()}
              {targets ? <Text style={[styles.unitSm, { color: t.textDim }]}>{` / ${targets.calories.toLocaleString()} cal`}</Text> : <Text style={styles.unitSm}> cal</Text>}
            </Text>
            {targets && (
              <Text style={{ color: totals.calories > targets.calories ? t.danger : t.textDim, fontSize: 13, fontWeight: '600' }}>
                {Math.abs(targets.calories - totals.calories).toLocaleString()} {totals.calories > targets.calories ? 'over' : 'left'}
              </Text>
            )}
          </View>
          <ProgressBar
            value={targets ? totals.calories / targets.calories : 0}
            height={8}
            color={targets && totals.calories > targets.calories ? t.danger : t.success}
          />
          {weekAvg !== null && (
            <Text style={{ color: t.textDim, fontSize: 12, marginTop: 10 }}>7-day avg {weekAvg.toLocaleString()} cal</Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, marginTop: 10 }]}>
          <View style={styles.macroRow}>
            <MacroCol t={t} label="Carbs" value={totals.carbsG} goal={targets?.carbsG} />
            <MacroCol t={t} label="Fat" value={totals.fatG} goal={targets?.fatG} />
            <MacroCol t={t} label="Protein" value={totals.proteinG} goal={targets?.proteinG} />
          </View>
        </View>

        <Pressable
          onPress={() => {
            tap();
            router.push('/diary' as Href);
          }}
          style={[styles.diaryRow, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <Ionicons name="book-outline" size={20} color={t.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>Diary</Text>
            <Text style={{ color: t.textDim, fontSize: 12 }}>
              {todays.length === 0 ? 'Nothing logged yet' : `${todays.length} ${todays.length === 1 ? 'item' : 'items'} today · by meal`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={t.textDim} />
        </Pressable>

        {(!goals || hasAiKey === false) && (
          <Pressable
            onPress={() => router.push('/meal-settings' as Href)}
            style={[styles.banner, { backgroundColor: t.accentSoft }]}
          >
            <Ionicons name="sparkles-outline" size={16} color={t.accent} />
            <Text style={{ color: t.accent, fontWeight: '600', flex: 1 }}>
              {!goals && hasAiKey === false
                ? 'Set goals and add an API key'
                : !goals
                  ? 'Set daily goals'
                  : 'Add an API key to analyze photos'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={t.accent} />
          </Pressable>
        )}

        <View>
        {/* Which section new food goes into */}
        <Text style={[styles.section, { color: t.textDim, marginTop: 20, marginBottom: 8 }]}>ADDING TO</Text>
        <View style={styles.slotRow}>
          {MEAL_SLOTS.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => {
                tap();
                setSlot(s.key);
              }}
              style={[styles.slotPill, { backgroundColor: slot === s.key ? t.accent : t.surfaceAlt }]}
            >
              <Text style={{ color: slot === s.key ? '#fff' : t.textDim, fontSize: 13, fontWeight: '700' }}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Quick actions */}
        <View style={styles.actions}>
          <Action t={t} icon="camera-outline" label="Photo" onPress={() => pick('camera')} />
          <Action t={t} icon="images-outline" label="Library" onPress={() => pick('library')} />
          <Action t={t} icon="search-outline" label="Search" onPress={() => { tap(); router.push(`/scan?slot=${slot}&mode=search` as Href); }} />
          <Action t={t} icon="barcode-outline" label="Scan" onPress={() => { tap(); router.push(`/scan?slot=${slot}&mode=scan` as Href); }} />
        </View>

        {photo && (
          <View style={[styles.preview, { backgroundColor: t.surfaceAlt }]}>
            <Pressable onPress={() => setViewPhoto(true)} style={StyleSheet.absoluteFill} accessibilityLabel="View photo full screen">
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              {busy && (
                <View style={[StyleSheet.absoluteFill, styles.previewBusy]}>
                  <ActivityIndicator color="#fff" size="large" />
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={clearPhoto}
              hitSlop={10}
              style={[styles.previewX, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
              accessibilityLabel="Remove photo"
            >
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        )}
        <Modal visible={viewPhoto && !!photo} transparent animationType="fade" onRequestClose={() => setViewPhoto(false)}>
          <View style={styles.viewer}>
            {photo && <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />}
            <Pressable
              onPress={() => setViewPhoto(false)}
              hitSlop={10}
              style={[styles.previewX, { top: insets.top + 12, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)' }]}
              accessibilityLabel="Close full screen photo"
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
        </Modal>

        <View style={[styles.composer, { backgroundColor: t.surface, borderColor: t.border }]}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Describe a meal — “200g paneer, 1 tsp ghee”"
            placeholderTextColor={t.textDim}
            multiline
            style={[styles.composerInput, { color: t.text }]}
          />
          <Pressable
            disabled={!canAnalyze}
            onPress={analyze}
            style={[styles.send, { backgroundColor: t.accent, opacity: canAnalyze ? 1 : 0.35 }]}
            accessibilityLabel={busy ? 'Cancel analysis' : 'Analyze meal'}
          >
            {busy ? (
              <>
                <ActivityIndicator color="#fff" size="small" style={StyleSheet.absoluteFill} />
                <Ionicons name="stop" size={10} color="#fff" />
              </>
            ) : (
              <Ionicons name="arrow-up" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
        {error && (
          <View style={styles.errRow}>
            <Text style={{ color: t.danger, fontSize: 13, flex: 1 }}>{error}</Text>
            <Pressable onPress={() => setError(null)} hitSlop={12} accessibilityLabel="Dismiss error">
              <Ionicons name="close" size={18} color={t.danger} />
            </Pressable>
          </View>
        )}
        </View>

        {/* Photos waiting for a successful analysis (rate limit / outage) */}
        {pendingList.some((p) => p.id !== cur?.id) && (
          <View style={{ marginTop: 14 }}>
            <Text style={[styles.section, { color: t.textDim }]}>SAVED PHOTOS — TAP TO ANALYZE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {pendingList
                .filter((p) => p.id !== cur?.id)
                .map((p) => (
                  <View key={p.id} style={styles.pendWrap}>
                    <Pressable onPress={() => loadPending(p)} accessibilityLabel="Analyze saved photo">
                      <Image source={{ uri: p.uri }} style={styles.pendThumb} />
                      <Text style={{ color: t.textDim, fontSize: 11, marginTop: 4 }}>
                        {slotLabel(p.slot)} · {p.date.slice(5)}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => dropPending(p)}
                      hitSlop={8}
                      style={[styles.previewX, { top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)' }]}
                      accessibilityLabel="Delete saved photo"
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
            </ScrollView>
          </View>
        )}

        {/* Review */}
        {draft && draftTotals && (
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, marginTop: 16 }]}>
            <View style={styles.reviewHead}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Meal name"
                placeholderTextColor={t.textDim}
                style={[styles.reviewTitle, { color: t.text }]}
              />
              <Pressable onPress={() => setShowDetails((s) => !s)} style={[styles.pill, { backgroundColor: t.surfaceAlt }]}>
                <Text style={{ color: t.textDim, fontSize: 12, fontWeight: '600' }}>
                  {draft.meal_confidence_score}/10
                </Text>
                <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={12} color={t.textDim} />
              </Pressable>
            </View>
            {showDetails && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: t.textDim, fontSize: 12 }}>
                  Estimate{usedModel ? ` · ${usedModel}` : ''}
                </Text>
                {draft.assumptions_made.map((a, i) => (
                  <Text key={i} style={{ color: t.textDim, fontSize: 12, marginTop: 2 }}>
                    • {a}
                  </Text>
                ))}
              </View>
            )}

            <View style={{ marginTop: 10 }}>
              {draft.ingredients.map((ing, i) =>
                editing === i ? (
                  <View key={`e-${i}-${draft.ingredients.length}`} style={[styles.ing, { borderColor: t.border }]}>
                    <View style={styles.row}>
                      <TextInput value={ing.name} onChangeText={(v) => editIngredient(i, { name: v })} style={[input, { flex: 1 }]} />
                      <Pressable onPress={() => dropIngredient(i)} hitSlop={10}>
                        <Ionicons name="trash-outline" size={18} color={t.danger} />
                      </Pressable>
                      <Pressable onPress={() => setEditing(null)} hitSlop={10}>
                        <Ionicons name="checkmark" size={20} color={t.success} />
                      </Pressable>
                    </View>
                    <View style={styles.row}>
                      <TextInput value={ing.estimated_quantity} onChangeText={(v) => editIngredient(i, { estimated_quantity: v })} style={[input, { flex: 2 }]} />
                      <NumField t={t} value={ing.calories} suffix="kcal" onChange={(n) => editIngredient(i, { calories: n })} />
                      <NumField t={t} value={ing.protein_g} suffix="g P" onChange={(n) => editIngredient(i, { protein_g: n })} />
                    </View>
                  </View>
                ) : (
                  <Pressable
                    key={`r-${i}-${draft.ingredients.length}`}
                    onPress={() => setEditing(i)}
                    style={[styles.ing, styles.ingRow, { borderColor: t.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontSize: 15 }} numberOfLines={1}>
                        {ing.name}
                      </Text>
                      {ing.estimated_quantity ? (
                        <Text style={{ color: t.textDim, fontSize: 12 }} numberOfLines={1}>
                          {ing.estimated_quantity}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ color: t.textDim, fontSize: 14 }}>{ing.calories}</Text>
                  </Pressable>
                ),
              )}
            </View>

            <View style={[styles.totalRow, { borderColor: t.border }]}>
              <View>
                <Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>
                  {draftTotals.calories} <Text style={styles.unit}>kcal</Text>
                </Text>
                <Text style={{ color: t.textDim, fontSize: 12 }}>
                  {draftTotals.proteinG} P · {draftTotals.carbsG} C · {draftTotals.fatG} F
                </Text>
              </View>
              <View style={styles.row}>
                <Pressable onPress={saveDraftAsFavorite} style={[styles.iconBtn, { backgroundColor: t.surfaceAlt }]} accessibilityLabel="Save as favorite">
                  <Ionicons name="star-outline" size={18} color={t.accent} />
                </Pressable>
                <Pressable onPress={() => setDraft(null)} style={[styles.iconBtn, { backgroundColor: t.surfaceAlt }]} accessibilityLabel="Discard">
                  <Ionicons name="close" size={18} color={t.textDim} />
                </Pressable>
              </View>
            </View>
            <Pressable
              disabled={draft.ingredients.length === 0}
              onPress={save}
              style={[styles.primary, { backgroundColor: t.success, opacity: draft.ingredients.length ? 1 : 0.4 }]}
            >
              <Text style={{ color: '#06231B', fontWeight: '800' }}>Add to {slotLabel(slot)}</Text>
            </Pressable>
          </View>
        )}

        {/* Quick log */}
        {saved.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={[styles.section, { color: t.textDim }]}>QUICK LOG</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {saved.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => logSaved(m)}
                  onLongPress={() =>
                    Alert.alert('Delete saved meal?', m.title, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => removeTemplate(m.id).catch(console.error) },
                    ])
                  }
                  style={({ pressed }) => [
                    styles.chip,
                    { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="add" size={14} color={t.accent} />
                  <Text style={{ color: t.text, fontSize: 14, fontWeight: '600', maxWidth: 140 }} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={{ color: t.textDim, fontSize: 12 }}>{m.calories}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

      </ScrollView>
    </Screen>
  );
}

function MacroCol({ t, label, value, goal }: { t: Theme; label: string; value: number; goal?: number }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: t.textDim, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '800', marginTop: 2 }}>
        {fmtN(value).toLocaleString()}
        <Text style={[styles.unitXs, { color: t.textDim }]}>{goal !== undefined ? ` / ${goal.toLocaleString()} g` : ' g'}</Text>
      </Text>
      <View style={{ marginTop: 8 }}>
        <ProgressBar value={goal ? value / goal : 0} height={6} />
      </View>
    </View>
  );
}

function Action({ t, icon, label, onPress }: { t: Theme; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={22} color={t.accent} />
      <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function NumField({
  t,
  value,
  suffix,
  onChange,
}: {
  t: Theme;
  value: number;
  suffix: string;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  return (
    <View style={{ flex: 1.3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          const n = Number(v.replace(',', '.'));
          onChange(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
        keyboardType="decimal-pad"
        style={[styles.input, { backgroundColor: t.surfaceAlt, color: t.text, flex: 1 }]}
      />
      <Text style={{ color: t.textDim, fontSize: 11 }}>{suffix}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  errRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '800' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: 18 },
  cardLabel: { fontSize: 13, fontWeight: '600' },
  calRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4, marginBottom: 10 },
  unit: { fontSize: 13, fontWeight: '600' },
  unitSm: { fontSize: 13, fontWeight: '600' },
  unitXs: { fontSize: 12, fontWeight: '600' },
  diaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, marginTop: 10 },
  macroRow: { flexDirection: 'row', gap: 14 },
  slotRow: { flexDirection: 'row', gap: 8 },
  slotPill: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  action: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: 8, marginTop: 10 },
  composerInput: { flex: 1, fontSize: 15, minHeight: 36, maxHeight: 110, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, overflow: 'hidden', marginTop: 10 },
  previewBusy: { backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  previewX: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pendWrap: { width: 96 },
  pendThumb: { width: 96, height: 96, borderRadius: radius.sm },
  viewer: { flex: 1, backgroundColor: '#000' },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewTitle: { flex: 1, fontSize: 18, fontWeight: '700', padding: 0 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  ing: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  input: { borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, marginTop: 4 },
  primary: { borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
});
