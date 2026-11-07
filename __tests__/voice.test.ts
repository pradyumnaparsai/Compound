import { cleanTranscript, mergeTranscript } from '../src/domain/voice';

describe('cleanTranscript', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanTranscript('  4 packets   of lays \n')).toBe('4 packets of lays');
  });
  it('drops bracketed noise tags and punctuation-only output', () => {
    expect(cleanTranscript('[BLANK_AUDIO]')).toBe('');
    expect(cleanTranscript(' . ')).toBe('');
  });
  it('keeps parentheses the user actually said', () => {
    expect(cleanTranscript('lays (80 g)')).toBe('lays (80 g)');
  });
});

describe('mergeTranscript', () => {
  it('uses the spoken text when the box is empty', () => {
    expect(mergeTranscript('', 'I had 4 packets of blue lays of 80 grams each')).toBe(
      'I had 4 packets of blue lays of 80 grams each',
    );
  });
  it('appends to existing text with one space', () => {
    expect(mergeTranscript('200g paneer ', ' and 2 rotis')).toBe('200g paneer and 2 rotis');
  });
  it('leaves the text alone when nothing was heard', () => {
    expect(mergeTranscript('200g paneer', '[BLANK_AUDIO]')).toBe('200g paneer');
  });
});
