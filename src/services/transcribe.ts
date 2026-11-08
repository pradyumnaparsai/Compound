import { File } from 'expo-file-system';
import { AnalysisFailed, UserError } from '@/domain/errors';
import { buildMultipart } from '@/domain/voice';
import { getGroqKey } from '@/services/mealAnalyzer';

const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3-turbo';
const TIMEOUT_MS = 30_000;
// Nudges Whisper toward food words and numbers (it otherwise mishears brand names).
const HINT = 'Food log: packets, grams, Lays, paneer, roti, dal, rice, curd, ghee, 80 g, 200 g.';

/** Speech → text via Groq Whisper (uses the Groq key already saved for meal analysis). */
export async function transcribeAudio(uri: string, signal?: AbortSignal, hint: string = HINT): Promise<string> {
  const key = await getGroqKey();
  if (!key) throw new UserError('Voice needs a Groq API key. Add one in Meal settings.');

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await new File(uri).arrayBuffer());
  } catch (e) {
    console.warn('Could not read recording', uri, e);
    throw new UserError('Could not read the recording. Please try again.');
  }
  if (bytes.length < 1000) throw new UserError('That recording was too short. Hold on a little longer, then tap stop.');
  const boundary = `----compound${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const body = buildMultipart(
    boundary,
    { model: MODEL, response_format: 'json', temperature: '0', prompt: hint },
    { field: 'file', filename: 'voice.m4a', type: 'audio/m4a', bytes },
  );

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: body.buffer as ArrayBuffer,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new AnalysisFailed(`Transcription HTTP ${res.status}`, res.status);
    const json = (await res.json()) as { text?: string };
    return json.text ?? '';
  } catch (e) {
    if (e instanceof AnalysisFailed) throw e;
    console.warn('Transcription request failed', e);
    const timedOut = e instanceof Error && e.name === 'AbortError';
    throw new AnalysisFailed(timedOut ? 'Transcription timed out' : 'Transcription network error', 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
