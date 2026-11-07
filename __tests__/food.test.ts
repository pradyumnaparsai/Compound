import { foodTitle, scaleFood, type Food } from '@/domain/food';
import { barcodeCandidates, toFood } from '@/services/openFoodFacts';

const food: Food = {
  barcode: '1',
  name: 'Oats',
  brand: 'Quaker',
  kcal100: 370,
  protein100: 13.5,
  carbs100: 60,
  fat100: 7,
  packG: 500,
  servingG: 40,
};

describe('food domain', () => {
  it('prefixes the brand unless the name already has it', () => {
    expect(foodTitle(food)).toBe('Quaker Oats');
    expect(foodTitle({ ...food, name: 'Quaker Oats' })).toBe('Quaker Oats');
  });

  it('scales per-100g values to grams', () => {
    expect(scaleFood(food, 40)).toEqual({
      name: 'Quaker Oats',
      estimated_quantity: '40 g',
      calories: 148,
      protein_g: 5.4,
      carbs_g: 24,
      fat_g: 2.8,
    });
  });
});

describe('Open Food Facts mapping', () => {
  it('maps a normal product', () => {
    const f = toFood({
      code: '123',
      product_name: ' Oats ',
      brands: 'Quaker, Other',
      product_quantity: '500',
      nutriments: { 'energy-kcal_100g': 370, proteins_100g: '13,5', carbohydrates_100g: 60, fat_100g: 7 },
    });
    expect(f).toMatchObject({ barcode: '123', name: 'Oats', brand: 'Quaker', kcal100: 370, protein100: 13.5, packG: 500 });
    expect(f?.prepared).toBeUndefined();
  });

  it('converts kJ to kcal and flags prepared-only values', () => {
    expect(toFood({ product_name: 'A', nutriments: { 'energy-kj_100g': 418.4 } })?.kcal100).toBe(100);
    expect(toFood({ product_name: 'A', nutriments: { 'energy-kcal_prepared_100g': 50 } })?.prepared).toBe(true);
  });

  it('returns null without energy or without any name', () => {
    expect(toFood({ product_name: 'A', nutriments: {} })).toBeNull();
    expect(toFood({ nutriments: { 'energy-kcal_100g': 10 } })).toBeNull();
  });

  it('tries both UPC-A and EAN-13 spellings', () => {
    expect(barcodeCandidates('012345678905')).toEqual(['012345678905', '0012345678905']);
    expect(barcodeCandidates('0012345678905')).toEqual(['0012345678905', '012345678905']);
    expect(barcodeCandidates('4-006381-333931')).toEqual(['4006381333931']);
  });
});
