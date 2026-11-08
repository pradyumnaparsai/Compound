import { create } from 'zustand';
import type { SettingsRepository } from '@/data/repository';
import { sqliteSettingsRepo } from '@/data/sqliteRepository';
import { defaultPlateConfig, type PlateConfig } from '@/domain/overload';
import { isWeightUnit, type WeightUnit } from '@/domain/units';

const repo: SettingsRepository = sqliteSettingsRepo;
const UNIT_KEY = 'weight_unit';
const PLATES_KEY = 'plate_config';

/** Parses stored plate config; anything malformed falls back to the default for the unit. */
export function parsePlateConfig(raw: string | null, unit: WeightUnit): PlateConfig {
  const fallback = defaultPlateConfig(unit);
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as Partial<PlateConfig>;
    const plates = Array.isArray(v.platesKg) ? v.platesKg.filter((p) => typeof p === 'number' && p > 0) : [];
    if (typeof v.barKg !== 'number' || !(v.barKg > 0) || plates.length === 0) return fallback;
    return { barKg: v.barKg, platesKg: [...plates].sort((a, b) => b - a) };
  } catch {
    return fallback;
  }
}

type State = {
  unit: WeightUnit;
  plates: PlateConfig;
  load: () => Promise<void>;
  setUnit: (u: WeightUnit) => Promise<void>;
  setPlates: (c: PlateConfig) => Promise<void>;
};

export const useUnitStore = create<State>((set, get) => ({
  unit: 'kg',
  plates: defaultPlateConfig('kg'),
  async load() {
    const raw = await repo.getValue(UNIT_KEY);
    const unit = isWeightUnit(raw) ? raw : 'kg';
    set({ unit, plates: parsePlateConfig(await repo.getValue(PLATES_KEY), unit) });
  },
  async setUnit(unit) {
    const prev = get().unit;
    set({ unit });
    try {
      await repo.setValue(UNIT_KEY, unit);
      // Switching unit swaps the default plate set unless the user customised it.
      if ((await repo.getValue(PLATES_KEY)) === null) set({ plates: defaultPlateConfig(unit) });
    } catch (e) {
      set({ unit: prev });
      throw e;
    }
  },
  async setPlates(plates) {
    await repo.setValue(PLATES_KEY, JSON.stringify(plates));
    set({ plates });
  },
}));
