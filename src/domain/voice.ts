/** Longest single voice note we record (keeps uploads small). */
export const MAX_RECORD_SECONDS = 60;

/** Whisper sometimes emits bracketed noise tags (e.g. [BLANK_AUDIO]) or only punctuation for silence. */
export function cleanTranscript(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s.,!?-]+$/, '');
}

/** Appends spoken text to what is already typed, with a single space between. */
export function mergeTranscript(existing: string, spoken: string): string {
  const add = cleanTranscript(spoken);
  if (!add) return existing;
  const base = existing.trim();
  return base ? `${base} ${add}` : add;
}

const ascii = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0x7f;
  return out;
};

/**
 * Builds a multipart/form-data body by hand. React Native's FormData file-descriptor ({ uri, name, type })
 * relies on the native networking layer re-opening the file, which fails with "Network request failed" for
 * some recordings; sending plain bytes avoids that. Field values and names must be ASCII.
 */
export function buildMultipart(
  boundary: string,
  fields: Record<string, string>,
  file: { field: string; filename: string; type: string; bytes: Uint8Array },
): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(ascii(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  parts.push(
    ascii(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`,
    ),
  );
  parts.push(file.bytes);
  parts.push(ascii(`\r\n--${boundary}--\r\n`));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** True when the transcript is just Whisper repeating its prompt (it does that on near-silent audio). */
export function isPromptEcho(text: string, hint: string): boolean {
  const w = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const t = w(text);
  const h = w(hint);
  if (t.length < 3 || h.length === 0) return false;
  return t.slice(0, 6).every((word, i) => word === h[i]);
}

/** One reading from the recorder's level meter. `ms` counts from the start of the recording. */
export type MeterSample = { ms: number; level: number };

export const AUTO_STOP = {
  /** Quiet this long after speech means the user has finished. */
  silenceMs: 1200,
  /** Never stop in the first moments (the user is still starting to talk). */
  minMs: 700,
  /** No clear speech by now: stop recording anyway and let transcription decide (it may just be a quiet voice). */
  noSpeechMs: 6000,
  /** Level above the quiet floor that counts as speech starting / still going (in dB). */
  startDb: 14,
  keepDb: 9,
};

/** The meter reports dB (about -160..0) on iOS; treat 0..1 values as linear amplitude to be safe. */
const toDb = (level: number, linear: boolean) => (linear ? 20 * Math.log10(Math.max(level, 1e-5)) : level);

/**
 * Decides from the level history whether to stop recording: after the user spoke and then went quiet, or after
 * a long stretch with no clear speech. Adaptive: the quiet floor is the lowest level seen, so it works in a noisy
 * room as well as a silent one.
 */
export function autoStopDecision(samples: MeterSample[], cfg = AUTO_STOP): 'continue' | 'stop' {
  const valid = samples.filter((s) => Number.isFinite(s.level));
  if (valid.length < 3) return 'continue';
  const now = valid[valid.length - 1].ms;
  if (now < cfg.minMs) return 'continue';
  const linear = valid.every((s) => s.level >= 0 && s.level <= 1);
  const db = valid.map((s) => toDb(s.level, linear));
  const floor = Math.min(...db);
  let heard = false;
  let lastVoiced = -1;
  db.forEach((d, i) => {
    if (d > floor + cfg.startDb) heard = true;
    if (heard && d > floor + cfg.keepDb) lastVoiced = valid[i].ms;
  });
  if (heard && now - lastVoiced >= cfg.silenceMs) return 'stop';
  if (!heard && now >= cfg.noSpeechMs) return 'stop';
  return 'continue';
}
