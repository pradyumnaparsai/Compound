import { maskKey } from '@/domain/apiKey';

describe('maskKey', () => {
  it('shows bullets plus the last 4 characters', () => {
    expect(maskKey('gsk_abcdef123456')).toBe('••••••••3456');
  });
  it('reveals the full trimmed key on request', () => {
    expect(maskKey(' gsk_abcdef123456 ', true)).toBe('gsk_abcdef123456');
  });
  it('hides short keys entirely', () => {
    expect(maskKey('abcd1234')).toBe('••••••••');
  });
  it('returns empty for blank input', () => {
    expect(maskKey('   ')).toBe('');
  });
});
