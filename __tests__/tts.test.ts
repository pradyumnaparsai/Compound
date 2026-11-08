import { cleanForSpeech, splitForSpeech, TTS_MAX_CHARS } from '../src/domain/tts';

describe('cleanForSpeech', () => {
  it('says units and symbols the way a person would', () => {
    expect(cleanForSpeech('Paneer wrap is 420 kcal · 22 g protein')).toBe('Paneer wrap is 420 calories, 22 grams protein');
    expect(cleanForSpeech('Weight 72.5 kg')).toBe('Weight 72.5 kilograms');
    expect(cleanForSpeech('Weight 180 lb')).toBe('Weight 180 pounds');
    expect(cleanForSpeech('Salt & pepper')).toBe('Salt and pepper');
  });
  it('turns ISO dates into spoken dates', () => {
    expect(cleanForSpeech('Moved to 2026-11-09.')).toBe('Moved to 9 November.');
  });
  it('drops markdown, brackets and emoji', () => {
    expect(cleanForSpeech('**Done** [cheerful] ✅ added')).toBe('Done added');
  });
  it('does not touch words that merely contain units', () => {
    expect(cleanForSpeech('I got a good deal on 5 gadgets')).toBe('I got a good deal on 5 gadgets');
  });
});

describe('splitForSpeech', () => {
  it('keeps short text as one chunk', () => {
    expect(splitForSpeech('Added milk to tomorrow.')).toEqual(['Added milk to tomorrow.']);
  });
  it('packs sentences up to the limit and splits after that', () => {
    const s = 'First sentence is here. Second sentence follows. Third one closes.';
    expect(splitForSpeech(s, 50)).toEqual(['First sentence is here. Second sentence follows.', 'Third one closes.']);
  });
  it('splits one long sentence at commas or spaces, never past the limit', () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ') + ', and then it ends';
    const parts = splitForSpeech(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= TTS_MAX_CHARS)).toBe(true);
    expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(long);
  });
  it('splits an unbroken string at the limit', () => {
    const parts = splitForSpeech('a'.repeat(450), 200);
    expect(parts.map((p) => p.length)).toEqual([200, 200, 50]);
  });
  it('returns nothing for blank input', () => {
    expect(splitForSpeech('   ')).toEqual([]);
  });
});
