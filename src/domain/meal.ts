/** 'database' = Open Food Facts / saved label values scaled to the eaten weight; 'saved' = re-logged favorite. */
export type InputType = 'barcode' | 'image_only' | 'image_and_note' | 'database' | 'saved';

export type Ingredient = {
  name: string;
  estimated_quantity: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

/** Result of an analysis, before it is saved. */
export type MealAnalysis = {
  title: string; // short header for the whole meal, e.g. "Dal Rice Thali"
  input_type: InputType;
  meal_confidence_score: number; // 1-10
  ingredients: Ingredient[];
  assumptions_made: string[];
};

export type MealSlot = 'breakfast' | 'lunch' | 'snacks' | 'dinner';

/** Display order of the day's sections. */
export const MEAL_SLOTS: { key: MealSlot; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'dinner', label: 'Dinner' },
];

export const isMealSlot = (v: unknown): v is MealSlot => MEAL_SLOTS.some((s) => s.key === v);
export const slotLabel = (k: MealSlot) => MEAL_SLOTS.find((s) => s.key === k)!.label;

/** Best-guess section for a moment in time (device-local hour). */
export function slotForTime(d: Date | string): MealSlot {
  const h = (typeof d === 'string' ? new Date(d) : d).getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snacks' : 'dinner';
}

export type Meal = {
  id: string;
  date: string; // YYYY-MM-DD, local
  slot: MealSlot;
  loggedAt: string;
  title: string;
  inputType: InputType;
  confidence: number;
  ingredients: Ingredient[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  assumptions: string[];
};

/** A reusable meal template; logging it needs no network call. */
export type SavedMeal = {
  id: string;
  title: string;
  ingredients: Ingredient[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  createdAt: string;
};

/** carbsG / fatG are optional; when absent they're derived from the calorie and protein goals. */
export type Goals = { calories: number; proteinG: number; carbsG?: number; fatG?: number };

/** Fills in missing carb/fat goals: the calories left after protein, split 70 % carbs / 30 % fat. */
export function macroGoals(g: Goals): { calories: number; proteinG: number; carbsG: number; fatG: number } {
  const rest = Math.max(0, g.calories - 4 * g.proteinG);
  return {
    calories: g.calories,
    proteinG: g.proteinG,
    carbsG: g.carbsG ?? Math.round((rest * 0.7) / 4),
    fatG: g.fatG ?? Math.round((rest * 0.3) / 9),
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export const totalsOf = (ingredients: Ingredient[]) => ({
  calories: Math.round(ingredients.reduce((a, i) => a + i.calories, 0)),
  proteinG: r1(ingredients.reduce((a, i) => a + i.protein_g, 0)),
  carbsG: r1(ingredients.reduce((a, i) => a + (i.carbs_g || 0), 0)),
  fatG: r1(ingredients.reduce((a, i) => a + (i.fat_g || 0), 0)),
});

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Older stored rows have no carbs/fat; default those to 0. */
export const normalizeIngredient = (i: Partial<Ingredient>): Ingredient => ({
  name: String(i.name ?? 'Unknown').slice(0, 80),
  estimated_quantity: String(i.estimated_quantity ?? '').slice(0, 60),
  calories: Math.round(num(i.calories)),
  protein_g: r1(num(i.protein_g)),
  carbs_g: r1(num(i.carbs_g)),
  fat_g: r1(num(i.fat_g)),
});

const TITLE_MAX = 40;

/** Fallback header when the model gives none: the first two item names, "+ N more" for the rest. */
export function mealTitle(ingredients: Pick<Ingredient, 'name'>[]): string {
  const names = ingredients.map((i) => i.name.trim()).filter((n) => n && n !== 'Unknown');
  if (names.length === 0) return 'Meal';
  const head = names.slice(0, 2).join(' + ');
  const t = names.length > 2 ? `${head} + ${names.length - 2} more` : head;
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1).trimEnd()}…` : t;
}

/** Cleans a model-supplied title: single line, no wrapping quotes, capped length. '' if unusable. */
export function cleanTitle(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.replace(/\s+/g, ' ').replace(/^["'“”‘’\s]+|["'“”‘’.\s]+$/g, '');
  return s.length > TITLE_MAX ? `${s.slice(0, TITLE_MAX - 1).trimEnd()}…` : s;
}

/** Prompt text asking the model to correct a previous estimate instead of starting over. */
export function buildRefineText(prev: { title: string; ingredients: Ingredient[] }, correction: string, originalNote?: string): string {
  const items = prev.ingredients.map((i) => ({
    name: i.name,
    estimated_quantity: i.estimated_quantity,
    calories: i.calories,
    protein_g: i.protein_g,
    carbs_g: i.carbs_g,
    fat_g: i.fat_g,
  }));
  return [
    originalNote?.trim() ? `Original user note: ${originalNote.trim()}` : null,
    `Previous estimate (JSON): ${JSON.stringify({ meal_title: prev.title, ingredients: items })}`,
    `User correction: ${correction.trim()}`,
    'The user is correcting the previous estimate. Treat the correction as fact. Return the FULL updated analysis in the usual format: apply the correction, keep every item the user did not mention unchanged, and update meal_title if the dish changed.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Strips <think> blocks, markdown fences and stray prose around the JSON object. */
export const stripFences = (raw: string) => {
  const s = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
};

/**
 * Validates untrusted model output. Totals are always recomputed from the ingredients
 * (models mis-add), so the "totals" field is ignored.
 */
export function parseAnalysis(raw: string, fallbackType: InputType): MealAnalysis {
  let data: unknown;
  try {
    data = JSON.parse(stripFences(raw));
  } catch {
    throw new Error('The model did not return valid JSON.');
  }
  if (!data || typeof data !== 'object') throw new Error('Unexpected response shape.');
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.ingredients) || o.ingredients.length === 0) {
    throw new Error('No ingredients were identified.');
  }
  const ingredients: Ingredient[] = o.ingredients
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map((i) => normalizeIngredient(i as Partial<Ingredient>));
  if (ingredients.length === 0) throw new Error('No ingredients were identified.');

  const type = o.input_type;
  const input_type: InputType =
    type === 'barcode' || type === 'image_only' || type === 'image_and_note' ? type : fallbackType;
  const conf = Math.round(num(o.meal_confidence_score));
  const assumptions = Array.isArray(o.assumptions_made)
    ? o.assumptions_made.map(String)
    : typeof o.assumptions_made === 'string'
      ? o.assumptions_made.split('\n').map((s) => s.replace(/^[-•*\s]+/, '')).filter(Boolean)
      : [];
  return {
    title: cleanTitle(o.meal_title) || mealTitle(ingredients),
    input_type,
    meal_confidence_score: Math.min(10, Math.max(1, conf || 1)),
    ingredients,
    assumptions_made: assumptions,
  };
}

export const dayTotals = (meals: Meal[]) => ({
  calories: Math.round(meals.reduce((a, m) => a + m.calories, 0)),
  proteinG: r1(meals.reduce((a, m) => a + m.proteinG, 0)),
  carbsG: r1(meals.reduce((a, m) => a + m.carbsG, 0)),
  fatG: r1(meals.reduce((a, m) => a + m.fatG, 0)),
});

/** Diary entry from an AI analysis (totals recomputed from the ingredients). */
export function mealFromAnalysis(a: MealAnalysis, slot: MealSlot, date: string, now: Date, id: string): Meal {
  return {
    id,
    date,
    slot,
    loggedAt: now.toISOString(),
    title: a.title,
    inputType: a.input_type,
    confidence: a.meal_confidence_score,
    ingredients: a.ingredients,
    ...totalsOf(a.ingredients),
    assumptions: a.assumptions_made,
  };
}

/** Diary entry for a saved meal logged by hand into the chosen section, stamped now. */
export function mealFromSaved(tpl: SavedMeal, slot: MealSlot, date: string, now: Date, id: string): Meal {
  const t = totalsOf(tpl.ingredients);
  return {
    id,
    date,
    slot,
    loggedAt: now.toISOString(),
    title: tpl.title,
    inputType: 'saved',
    confidence: 10,
    ingredients: tpl.ingredients,
    calories: t.calories,
    proteinG: t.proteinG,
    carbsG: t.carbsG,
    fatG: t.fatG,
    assumptions: ['Logged from a saved meal.'],
  };
}
