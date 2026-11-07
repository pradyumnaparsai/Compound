import type { Ingredient } from './meal';

/** Per-100g label values for a packaged food (from Open Food Facts or typed in by the user). */
export type Food = {
  barcode: string; // '' for name-search hits without a code
  name: string;
  brand: string;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  packG: number | null; // whole pack weight in g (or ml), if known
  servingG: number | null;
  /** true when only "as prepared" values existed (e.g. powders); may differ from the dry pack */
  prepared?: boolean;
  /** sold in India (Open Food Facts countries_tags); used to rank search hits */
  indian?: boolean;
};

export const foodTitle = (f: Food) => (f.brand && !f.name.toLowerCase().includes(f.brand.toLowerCase()) ? `${f.brand} ${f.name}` : f.name);

/** Scales per-100g values to the eaten grams. */
export function scaleFood(f: Food, grams: number): Ingredient {
  const k = grams / 100;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    name: foodTitle(f).slice(0, 80),
    estimated_quantity: `${Math.round(grams * 10) / 10} g`,
    calories: Math.round(f.kcal100 * k),
    protein_g: r1(f.protein100 * k),
    carbs_g: r1(f.carbs100 * k),
    fat_g: r1(f.fat100 * k),
  };
}
