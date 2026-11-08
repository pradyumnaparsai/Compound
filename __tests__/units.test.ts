import { formatNumber, formatWeight, kgToUnit, parseWeightInput, unitToKg } from '@/domain/units';

describe('units', () => {
  it('converts both ways', () => {
    expect(kgToUnit(100, 'kg')).toBe(100);
    expect(kgToUnit(100, 'lb')).toBeCloseTo(220.462, 3);
    expect(unitToKg(135, 'lb')).toBeCloseTo(61.235, 3);
    expect(unitToKg(kgToUnit(61.2, 'lb'), 'lb')).toBeCloseTo(61.2, 9);
  });
  it('formats without trailing zeros', () => {
    expect(formatNumber(62.5)).toBe('62.5');
    expect(formatNumber(135.0001)).toBe('135');
    expect(formatNumber(-0.01)).toBe('0');
    expect(formatWeight(61.2349, 'lb')).toBe('135 lb');
    expect(formatWeight(60, 'kg')).toBe('60 kg');
  });
  it('parses input with comma decimals and rejects junk', () => {
    expect(parseWeightInput('62,5', 'kg')).toBe(62.5);
    expect(parseWeightInput('135', 'lb')).toBeCloseTo(61.235, 3);
    expect(parseWeightInput('', 'kg')).toBeNull();
    expect(parseWeightInput('-', 'kg')).toBeNull();
    expect(parseWeightInput('abc', 'kg')).toBeNull();
    expect(parseWeightInput('-20', 'kg')).toBe(-20);
  });
});
