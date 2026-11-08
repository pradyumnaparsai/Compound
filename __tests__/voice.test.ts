import { autoStopDecision, buildMultipart, cleanTranscript, isPromptEcho, mergeTranscript, type MeterSample } from '../src/domain/voice';

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

describe('isPromptEcho', () => {
  const hint = 'Add task, routine, meal, breakfast, lunch, dinner, tomorrow, kilograms, calories, protein.';
  it('detects Whisper repeating the prompt', () => {
    expect(isPromptEcho('Add task, routine, meal, breakfast, lunch.', hint)).toBe(true);
    expect(isPromptEcho(hint, hint)).toBe(true);
  });
  it('lets real requests through, even ones that start with the same words', () => {
    expect(isPromptEcho('Add a task to buy milk tomorrow', hint)).toBe(false);
    expect(isPromptEcho('Add task', hint)).toBe(false);
  });
});

describe('autoStopDecision', () => {
  // 100 ms samples: quiet -55 dB, speech -20 dB.
  const track = (levels: number[]): MeterSample[] => levels.map((level, i) => ({ ms: i * 100, level }));
  const quiet = (n: number) => Array(n).fill(-55);
  const talk = (n: number) => Array(n).fill(-20);

  it('keeps recording while the user is talking', () => {
    expect(autoStopDecision(track([...quiet(3), ...talk(15)]))).toBe('continue');
  });
  it('stops after speech followed by a pause', () => {
    expect(autoStopDecision(track([...quiet(3), ...talk(10), ...quiet(12)]))).toBe('stop');
  });
  it('waits out a short breath between words', () => {
    expect(autoStopDecision(track([...quiet(3), ...talk(8), ...quiet(5), ...talk(4)]))).toBe('continue');
    expect(autoStopDecision(track([...quiet(3), ...talk(8), ...quiet(8)]))).toBe('continue');
  });
  it('does not stop in the first moments or with too few samples', () => {
    expect(autoStopDecision(track([-55, -55]))).toBe('continue');
    expect(autoStopDecision(track(quiet(6)))).toBe('continue');
  });
  it('gives up when nothing but quiet was heard for a long time', () => {
    expect(autoStopDecision(track(quiet(65)))).toBe('stop');
  });
  it('adapts to a noisy room', () => {
    const noisy = Array(3).fill(-35);
    expect(autoStopDecision(track([...noisy, ...Array(10).fill(-10), ...Array(12).fill(-35)]))).toBe('stop');
  });
  it('understands linear 0..1 meters too', () => {
    const q = Array(3).fill(0.002);
    const t = Array(10).fill(0.3);
    expect(autoStopDecision(track([...q, ...t, ...Array(12).fill(0.002)]))).toBe('stop');
    expect(autoStopDecision(track([...q, ...t]))).toBe('continue');
  });
  it('ignores samples with no level', () => {
    expect(autoStopDecision(track([NaN, NaN, NaN, NaN]))).toBe('continue');
  });
});
