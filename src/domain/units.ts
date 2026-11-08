export type WeightUnit = 'kg' | 'lb';
export const KG_PER_LB = 0.45359237;

export const isWeightUnit = (v: unknown): v is WeightUnit => v === 'kg' || v === 'lb';

/** Weights are always stored in kg; these convert for display and input. */
export const kgToUnit = (kg: number, unit: WeightUnit) => (unit === 'kg' ? kg : kg / KG_PER_LB);
export const unitToKg = (v: number, unit: WeightUnit) => (unit === 'kg' ? v : v * KG_PER_LB);

/** "62.5", "135", never "62.50"; one decimal at most. */
export function formatNumber(v: number, digits = 1): string {
  const f = 10 ** digits;
  const r = Math.round(v * f) / f;
  return Object.is(r, -0) ? '0' : String(r);
}

export const formatWeight = (kg: number, unit: WeightUnit, digits = 1) => `${formatNumber(kgToUnit(kg, unit), digits)} ${unit}`;

/** Parses "62,5" / "62.5" typed in `unit` into kg; null when empty or not a finite number. */
export function parseWeightInput(text: string, unit: WeightUnit): number | null {
  const s = text.trim().replace(',', '.');
  if (s === '' || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? unitToKg(n, unit) : null;
}
