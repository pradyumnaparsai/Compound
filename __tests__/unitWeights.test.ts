import { guessUnitGrams } from '@/domain/unitWeights';

describe('guessUnitGrams', () => {
  it('suggests weights for plain whole foods', () => {
    expect(guessUnitGrams('Apple')).toBe(180);
    expect(guessUnitGrams('red apple')).toBe(180);
    expect(guessUnitGrams('Roti')).toBe(40);
  });
  it('ignores branded / multi-word products and unknowns', () => {
    expect(guessUnitGrams('Apple juice drink 1L')).toBeNull();
    expect(guessUnitGrams('Quinoa')).toBeNull();
    expect(guessUnitGrams('')).toBeNull();
  });
});
