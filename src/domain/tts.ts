// Pure text helpers for spoken replies: make text sound natural and fit the TTS input limit.
import { MONTH_NAMES } from './date';

/** Groq Orpheus accepts at most 200 characters per request. */
export const TTS_MAX_CHARS = 200;

const monthName = (m: number) => MONTH_NAMES[m - 1] ?? '';

/** Strips markup and rewrites symbols and units the way a person would say them. */
export function cleanForSpeech(raw: string): string {
  return raw
    .replace(/[*_`#>~]+/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ') // [bracketed] text would be read as a vocal direction
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ') // emoji
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_m, _y, mo: string, d: string) => `${Number(d)} ${monthName(Number(mo))}`)
    .replace(/\bkcal\b/gi, 'calories')
    .replace(/\bkgs?\b/gi, 'kilograms')
    .replace(/(\d)\s?g\b/g, '$1 grams')
    .replace(/\s*[·•|]\s*/g, ', ')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitLong(s: string, max: number): string[] {
  const out: string[] = [];
  let rest = s.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max + 1);
    let cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(': '));
    if (cut < max * 0.4) cut = window.lastIndexOf(' ');
    const end = cut <= 0 ? max : cut + 1; // no break found: hard cut at the limit
    out.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Splits text into chunks of at most `max` characters, breaking at sentence ends first, then commas, then spaces,
 * and packing short sentences together so each request carries as much natural phrasing as possible.
 */
export function splitForSpeech(text: string, max: number = TTS_MAX_CHARS): string[] {
  const sentences: string[] = [];
  let run: string[] = [];
  for (const w of text.trim().split(/\s+/).filter(Boolean)) {
    run.push(w);
    if (/[.!?]["')\]]*$/.test(w)) {
      sentences.push(run.join(' '));
      run = [];
    }
  }
  if (run.length) sentences.push(run.join(' '));
  const chunks: string[] = [];
  let cur = '';
  for (const s of sentences.flatMap((x) => (x.length > max ? splitLong(x, max) : [x]))) {
    if (cur && cur.length + 1 + s.length > max) {
      chunks.push(cur);
      cur = s;
    } else {
      cur = cur ? `${cur} ${s}` : s;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}
