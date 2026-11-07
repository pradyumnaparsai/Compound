import { tokenize } from './foodSearch';

/** Typical edible weight (g) of one piece of common whole foods. Only a starting suggestion. */
const TYPICAL_G: Record<string, number> = {
  apple: 180, banana: 120, orange: 130, mango: 200, pear: 180, guava: 100, pomegranate: 200,
  grapes: 80, papaya: 150, kiwi: 70, peach: 150, plum: 65, lemon: 60, potato: 150, tomato: 120,
  onion: 110, carrot: 60, cucumber: 200, egg: 50, roti: 40, chapati: 40, phulka: 30, paratha: 80,
  naan: 90, idli: 40, dosa: 80, bread: 30, slice: 30, biscuit: 10, almond: 1.2, almonds: 1.2,
  cashew: 1.5, cashews: 1.5, dates: 8, date: 8, samosa: 60, puri: 25, vada: 50,
};

/** Suggested grams per unit for a plain whole-food name ("apple", "red apple"); null otherwise. */
export function guessUnitGrams(name: string): number | null {
  const t = tokenize(name);
  if (t.length === 0 || t.length > 2) return null;
  for (const w of t) if (TYPICAL_G[w] !== undefined) return TYPICAL_G[w];
  return null;
}
