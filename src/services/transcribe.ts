import { AnalysisFailed, UserError } from '@/domain/errors';
import { getGroqKey } from '@/services/mealAnalyzer';

const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3-turbo';
const TIMEOUT_MS = 30_000;
// Nudges Whisper toward food words and numbers (it otherwise mishears brand names).
const HINT = 'Food log: packets, grams, Lays, paneer, roti, dal, rice, curd, ghee, 80 g, 200 g.';

/** Speech → text via Groq Whisper (uses the Groq key already saved for meal analysis). */
export async function transcribeAudio(uri: string, signal?: AbortSignal): Promise<string> {
  const key = await getGroqKey();
  if (!key) throw new UserError('Voice needs a Groq API key. Add one in Meal settings.');

  const form = new FormData();
  // React Native's FormData accepts a { uri, name, type } descriptor for files.
  form.append('file', { uri, name: 'voice.m4a', type: 'audio/m4a' } as unknown as Blob);
  form.append('model', MODEL);
  form.append('response_format', 'json');
  form.append('temperature', '0');
  form.append('prompt', HINT);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new AnalysisFailed(`Transcription HTTP ${res.status}`, res.status);
    const json = (await res.json()) as { text?: string };
    return json.text ?? '';
  } catch (e) {
    if (e instanceof AnalysisFailed) throw e;
    const timedOut = e instanceof Error && e.name === 'AbortError';
    throw new AnalysisFailed(timedOut ? 'Transcription timed out' : 'Transcription network error', 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
