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
