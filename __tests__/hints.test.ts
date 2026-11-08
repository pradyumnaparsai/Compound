import { hintFlag, shouldShowHint } from '@/domain/hints';

describe('shouldShowHint', () => {
  it('hides while the flag is loading', () => expect(shouldShowHint(null)).toBe(false));
  it('shows on first install', () => expect(shouldShowHint(false)).toBe(true));
  it('hides once seen in an earlier session', () => expect(shouldShowHint(true)).toBe(false));
});

describe('hintFlag', () => {
  it('namespaces keys', () => expect(hintFlag('reorder')).toBe('hint_reorder'));
});
