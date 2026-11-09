import {
  buildRefineText,
  cleanTitle,
  dayTotals,
  mealTitle,
  macroGoals,
  mealFromSaved,
  normalizeIngredient,
  parseAnalysis,
  parseGoalsInput,
  renameMeal,
  slotForTime,
  totalsOf,
  withoutIngredient,
  type Meal,
  type SavedMeal,
} from '@/domain/meal';

const ing = (over = {}) => ({
  name: 'Rice',
  estimated_quantity: '100 g',
  calories: 130,
  protein_g: 2.7,
  carbs_g: 28,
  fat_g: 0.3,
  ...over,
});

describe('slotForTime', () => {
  it.each([
    [8, 'breakfast'],
    [12, 'lunch'],
    [16, 'snacks'],
    [20, 'dinner'],
  ])('hour %i -> %s', (h, slot) => {
    expect(slotForTime(new Date(2026, 10, 7, h))).toBe(slot);
  });
});

describe('macroGoals', () => {
  it('derives carbs/fat from remaining calories 70/30', () => {
    expect(macroGoals({ calories: 2000, proteinG: 150 })).toEqual({
      calories: 2000,
      proteinG: 150,
      carbsG: Math.round((1400 * 0.7) / 4),
      fatG: Math.round((1400 * 0.3) / 9),
    });
  });

  it('keeps explicit values and never goes negative', () => {
    expect(macroGoals({ calories: 100, proteinG: 100, carbsG: 5, fatG: 6 })).toMatchObject({ carbsG: 5, fatG: 6 });
    expect(macroGoals({ calories: 100, proteinG: 100 })).toMatchObject({ carbsG: 0, fatG: 0 });
  });
});

describe('totals', () => {
  it('sums ingredients with rounding', () => {
    expect(totalsOf([ing(), ing({ calories: 70.4, protein_g: 0.34 })])).toEqual({
      calories: 200,
      proteinG: 3.0,
      carbsG: 56,
      fatG: 0.6,
    });
  });

  it('sums a day of meals', () => {
    const m = { calories: 500, proteinG: 30.25, carbsG: 50, fatG: 10 } as Meal;
    expect(dayTotals([m, m])).toEqual({ calories: 1000, proteinG: 60.5, carbsG: 100, fatG: 20 });
  });
});

describe('normalizeIngredient', () => {
  it('sanitises bad values and old rows', () => {
    expect(normalizeIngredient({ name: 'X', calories: -5, protein_g: '1,5' as unknown as number })).toEqual({
      name: 'X',
      estimated_quantity: '',
      calories: 0,
      protein_g: 1.5,
      carbs_g: 0,
      fat_g: 0,
    });
  });
});

describe('mealTitle / cleanTitle', () => {
  it('falls back to "Meal" and skips unnamed items', () => {
    expect(mealTitle([])).toBe('Meal');
    expect(mealTitle([{ name: 'Unknown' }])).toBe('Meal');
    expect(mealTitle([{ name: 'Rice' }, { name: 'Dal' }])).toBe('Rice + Dal');
  });

  it('caps long titles', () => {
    const long = 'A'.repeat(100);
    expect(mealTitle([{ name: long }]).length).toBeLessThanOrEqual(40);
    expect(cleanTitle(long).length).toBeLessThanOrEqual(40);
  });

  it('rejects non-strings and blanks', () => {
    expect(cleanTitle(undefined)).toBe('');
    expect(cleanTitle('  ""  ')).toBe('');
  });
});

describe('buildRefineText', () => {
  const prev = { title: 'Dal Rice', ingredients: [ing({ name: 'Dal' }), ing()] };

  it('includes previous items, the correction and the original note', () => {
    const t = buildRefineText(prev, '  rice is half  ', '200g dal');
    expect(t).toContain('Original user note: 200g dal');
    expect(t).toContain('"name":"Dal"');
    expect(t).toContain('User correction: rice is half');
  });

  it('omits the note line when there is none', () => {
    expect(buildRefineText(prev, 'x', '  ')).not.toContain('Original user note');
  });
});

describe('parseAnalysis', () => {
  const json = JSON.stringify({
    input_type: 'image_only',
    meal_confidence_score: 7.4,
    ingredients: [ing()],
    assumptions_made: ['- cooked rice'],
    totals: { calories: 99999 },
  });

  it('parses clean JSON and ignores model-supplied totals', () => {
    const r = parseAnalysis(json, 'image_and_note');
    expect(r.input_type).toBe('image_only');
    expect(r.meal_confidence_score).toBe(7);
    expect(r.ingredients).toHaveLength(1);
    expect(r).not.toHaveProperty('totals');
  });

  it('strips <think> blocks and markdown fences', () => {
    const wrapped = `<think>hmm {not json}</think>\n\`\`\`json\n${json}\n\`\`\``;
    expect(parseAnalysis(wrapped, 'image_only').ingredients[0].name).toBe('Rice');
  });

  it('falls back on input type, clamps confidence, splits string assumptions', () => {
    const r = parseAnalysis(
      JSON.stringify({ input_type: 'bogus', meal_confidence_score: 99, ingredients: [ing()], assumptions_made: '- a\n• b' }),
      'barcode',
    );
    expect(r.input_type).toBe('barcode');
    expect(r.meal_confidence_score).toBe(10);
    expect(r.assumptions_made).toEqual(['a', 'b']);
  });

  it('uses the model meal_title, cleaned up', () => {
    const r = parseAnalysis(JSON.stringify({ meal_title: '  "Dal Rice\nThali." ', ingredients: [ing()] }), 'image_only');
    expect(r.title).toBe('Dal Rice Thali');
  });

  it('derives a title from the items when the model gives none', () => {
    const items = [ing({ name: 'Roti' }), ing({ name: 'Dal' }), ing({ name: 'Curd' }), ing({ name: 'Salad' })];
    expect(parseAnalysis(JSON.stringify({ ingredients: items }), 'image_only').title).toBe('Roti + Dal + 2 more');
    expect(parseAnalysis(JSON.stringify({ meal_title: 42, ingredients: [ing()] }), 'image_only').title).toBe('Rice');
  });

  it('rejects invalid output', () => {
    expect(() => parseAnalysis('not json', 'image_only')).toThrow('valid JSON');
    expect(() => parseAnalysis('{"ingredients":[]}', 'image_only')).toThrow('No ingredients');
    expect(() => parseAnalysis('{"ingredients":[1,null]}', 'image_only')).toThrow('No ingredients');
    expect(() => parseAnalysis('[]', 'image_only')).toThrow();
  });
});

describe('mealFromSaved', () => {
  const tpl: SavedMeal = {
    id: 'sm1',
    title: 'Shake',
    ingredients: [ing({ name: 'Whey', calories: 120, protein_g: 24 }), ing({ name: 'Milk', calories: 80, protein_g: 6 })],
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    createdAt: '2026-11-01T00:00:00.000Z',
  };
  const now = new Date(2026, 10, 7, 9, 30);

  it('logs into the chosen slot and date with totals recomputed from the items', () => {
    const m = mealFromSaved(tpl, 'dinner', '2026-11-07', now, 'x1');
    expect(m).toMatchObject({ id: 'x1', slot: 'dinner', date: '2026-11-07', title: 'Shake', inputType: 'saved', calories: 200 });
    expect(m.proteinG).toBeCloseTo(30);
    expect(m.loggedAt).toBe(now.toISOString());
    expect(m.ingredients).toEqual(tpl.ingredients);
  });
});

describe('withoutIngredient', () => {
  const base = (): Meal => {
    const ingredients = [ing({ name: 'A', calories: 100 }), ing({ name: 'B', calories: 50 }), ing({ name: 'C', calories: 25 })];
    return {
      id: 'x',
      date: '2026-11-08',
      slot: 'lunch',
      loggedAt: '2026-11-08T12:00:00.000Z',
      title: 'Plate',
      inputType: 'image_only',
      confidence: 7,
      ingredients,
      ...totalsOf(ingredients),
      assumptions: [],
    };
  };

  it('drops the item and recomputes totals', () => {
    const next = withoutIngredient(base(), 1)!;
    expect(next.ingredients.map((i) => i.name)).toEqual(['A', 'C']);
    expect(next.calories).toBe(125);
    expect(next.proteinG).toBe(5.4);
    expect(next.id).toBe('x');
    expect(next.slot).toBe('lunch');
  });

  it('returns null when the last item is removed', () => {
    const one = withoutIngredient(base(), 0)!;
    const two = withoutIngredient(one, 0)!;
    expect(withoutIngredient(two, 0)).toBeNull();
  });

  it('ignores an out-of-range index', () => {
    const m = base();
    expect(withoutIngredient(m, 3)).toBe(m);
    expect(withoutIngredient(m, -1)).toBe(m);
  });

  it('does not mutate the input', () => {
    const m = base();
    withoutIngredient(m, 0);
    expect(m.ingredients).toHaveLength(3);
    expect(m.calories).toBe(175);
  });
});

describe('renameMeal', () => {
  const m = (): Meal => {
    const ingredients = [ing()];
    return {
      id: 'x',
      date: '2026-11-08',
      slot: 'lunch',
      loggedAt: '2026-11-08T12:00:00.000Z',
      title: 'Wrong dish',
      inputType: 'image_only',
      confidence: 7,
      ingredients,
      ...totalsOf(ingredients),
      assumptions: [],
    };
  };

  it('renames with trimmed, collapsed whitespace without mutating', () => {
    const orig = m();
    const next = renameMeal(orig, '  Rajma   Rice ');
    expect(next.title).toBe('Rajma Rice');
    expect(orig.title).toBe('Wrong dish');
    expect(next.ingredients).toBe(orig.ingredients);
  });

  it('keeps the old title for blank input and returns the same object when unchanged', () => {
    const orig = m();
    expect(renameMeal(orig, '   ')).toBe(orig);
    expect(renameMeal(orig, 'Wrong dish')).toBe(orig);
  });

  it('caps very long titles', () => {
    expect(renameMeal(m(), 'x'.repeat(200)).title).toHaveLength(80);
  });
});

describe('parseGoalsInput', () => {
  it('all blank clears the goals', () => {
    expect(parseGoalsInput('', ' ', '', '')).toBeNull();
  });
  it('accepts calories + protein with derived carbs/fat', () => {
    expect(parseGoalsInput('2200', '150', '', '')).toEqual({ calories: 2200, proteinG: 150, carbsG: undefined, fatG: undefined });
  });
  it('accepts explicit carbs/fat and decimal commas', () => {
    expect(parseGoalsInput('2200,4', '150', '250', '70')).toEqual({ calories: 2200, proteinG: 150, carbsG: 250, fatG: 70 });
  });
  it('rejects missing/zero/out-of-range values', () => {
    expect(parseGoalsInput('', '150', '', '')).toBe('invalid');
    expect(parseGoalsInput('2200', '0', '', '')).toBe('invalid');
    expect(parseGoalsInput('20000', '150', '', '')).toBe('invalid');
    expect(parseGoalsInput('2200', '150', 'abc', '')).toBe('invalid');
    expect(parseGoalsInput('2200', '150', '', '-5')).toBe('invalid');
  });
});
