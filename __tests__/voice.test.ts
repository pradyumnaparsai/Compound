import { buildMultipart, cleanTranscript, mergeTranscript } from '../src/domain/voice';

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

describe('buildMultipart', () => {
  const text = (u: Uint8Array) => Array.from(u, (b) => String.fromCharCode(b)).join('');

  it('wraps fields and the file in boundaries, keeping the file bytes intact', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const out = buildMultipart('BND', { model: 'm', temperature: '0' }, { field: 'file', filename: 'v.m4a', type: 'audio/m4a', bytes });
    const s = text(out);
    expect(s.startsWith('--BND\r\nContent-Disposition: form-data; name="model"\r\n\r\nm\r\n')).toBe(true);
    expect(s).toContain('name="file"; filename="v.m4a"\r\nContent-Type: audio/m4a\r\n\r\n');
    expect(s.endsWith('\r\n--BND--\r\n')).toBe(true);
    const start = s.indexOf('Content-Type: audio/m4a\r\n\r\n') + 'Content-Type: audio/m4a\r\n\r\n'.length;
    expect(Array.from(out.slice(start, start + 5))).toEqual([0, 1, 2, 250, 255]);
  });
});
