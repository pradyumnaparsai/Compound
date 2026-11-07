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
