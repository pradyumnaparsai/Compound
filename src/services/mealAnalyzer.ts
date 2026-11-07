import * as SecureStore from 'expo-secure-store';
import { recordUsage } from '@/services/aiUsage';
import { AnalysisFailed, UserError } from '@/domain/errors';
import { parseAnalysis, type InputType, type MealAnalysis } from '@/domain/meal';
import {
  DEFAULT_GROQ_MODEL,
  DEFAULT_MODEL,
  GEMINI_KEY_STORE,
  GEMINI_MODEL_STORE,
  GEMINI_URL_BASE,
  GROQ_KEY_STORE,
  GROQ_MODEL_STORE,
  GROQ_URL,
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  SYSTEM_PROMPT,
  TEMPERATURE,
  TEST_PNG,
  TIMEOUT_MS,
  TRANSIENT_STATUSES,
} from '@/services/mealAnalyzerConstants';

export const getApiKey = () => SecureStore.getItemAsync(GEMINI_KEY_STORE);
export const setApiKey = (key: string) => SecureStore.setItemAsync(GEMINI_KEY_STORE, key.trim());
export const clearApiKey = () => SecureStore.deleteItemAsync(GEMINI_KEY_STORE);
export const getModel = async () => (await SecureStore.getItemAsync(GEMINI_MODEL_STORE)) || DEFAULT_MODEL;
export const setModel = (m: string) =>
  m.trim() ? SecureStore.setItemAsync(GEMINI_MODEL_STORE, m.trim()) : SecureStore.deleteItemAsync(GEMINI_MODEL_STORE);

export const getGroqKey = () => SecureStore.getItemAsync(GROQ_KEY_STORE);
export const setGroqKey = (key: string) => SecureStore.setItemAsync(GROQ_KEY_STORE, key.trim());
export const clearGroqKey = () => SecureStore.deleteItemAsync(GROQ_KEY_STORE);
export const getGroqModel = async () => (await SecureStore.getItemAsync(GROQ_MODEL_STORE)) || DEFAULT_GROQ_MODEL;
export const setGroqModel = (m: string) =>
  m.trim() ? SecureStore.setItemAsync(GROQ_MODEL_STORE, m.trim()) : SecureStore.deleteItemAsync(GROQ_MODEL_STORE);

export class AnalysisCancelled extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'AnalysisCancelled';
  }
}

export type AnalyzeInput = {
  imageBase64?: string;
  mimeType?: string;
  note?: string;
  barcode?: string;
  signal?: AbortSignal;
};

type CallResult = { ok: true; text: string } | { ok: false; status: number; message: string };
type Target = { label: string; call: (signal?: AbortSignal) => Promise<CallResult> };

/**
 * Tries Groq first (if a key is saved), then Gemini (if a key is saved).
 * Each target gets one retry on transient errors. Returns the analysis and which model produced it.
 */
export async function analyzeMeal(input: AnalyzeInput): Promise<MealAnalysis & { model: string }> {
  const { signal } = input;
  const ensureActive = () => {
    if (signal?.aborted) throw new AnalysisCancelled();
  };
  ensureActive();
  const note = input.note?.trim();
  const barcode = input.barcode?.trim();
  if (!input.imageBase64 && !barcode && !note) throw new UserError('Add a photo or describe the meal first.');

  const [groqKey, geminiKey] = await Promise.all([getGroqKey(), getApiKey()]);
  ensureActive();
  if (!groqKey && !geminiKey) throw new UserError('Add a Groq or Gemini API key in Meal settings to use AI.');

  const inputType: InputType = barcode ? 'barcode' : note ? 'image_and_note' : 'image_only';
  const text = [
    barcode ? `Barcode/Product: ${barcode}` : null,
    note ? `User note: ${note}` : null,
    !barcode && !note ? 'No user note provided.' : null,
  ]
    .filter(Boolean)
    .join('\n');
  const mime = input.mimeType ?? 'image/jpeg';

  const targets: Target[] = [];
  if (groqKey) {
    const model = await getGroqModel();
    targets.push({ label: `groq:${model}`, call: (sig) => callGroq(model, groqKey, text, input.imageBase64, mime, sig) });
  }
  if (geminiKey) {
    const model = await getModel();
    targets.push({ label: `gemini:${model}`, call: (sig) => callGemini(model, geminiKey, text, input.imageBase64, mime, sig) });
  }

  let lastMessage = 'Analysis failed.';
  let lastStatus = 0;
  for (const target of targets) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      ensureActive();
      const r = await target.call(signal);
      ensureActive();
      if (r.ok) {
        try {
          return { ...parseAnalysis(r.text, inputType), model: target.label };
        } catch (e) {
          lastMessage = `${target.label}: ${e instanceof Error ? e.message : String(e)}`;
          lastStatus = -1;
          break; // bad output: next target rather than the same one
        }
      }
      lastMessage = `${target.label}: ${r.message}`;
      lastStatus = r.status;
      console.warn('Meal analysis target failed:', lastMessage); // why a provider was skipped (e.g. Groq → Gemini)
      if (!TRANSIENT_STATUSES.has(r.status)) {
        // Bad key / bad request: another model on the same provider won't help, but another provider might.
        break;
      }
    }
  }
  // Technical detail stays in the log; the UI shows friendlyError(e).
  const technical = `${lastMessage} (tried ${targets.map((t) => t.label).join(', ')})`;
  console.warn('Meal analysis failed:', technical);
  throw new AnalysisFailed(technical, lastStatus);
}

export type ProviderCheck = { label: 'Text' | 'Image'; ok: boolean; detail: string };

/**
 * Sends a tiny text request and a tiny image request through the same code path as real meal analysis
 * (system prompt, JSON mode, image part), so a model that can't take images or JSON mode shows up here
 * instead of silently falling back. `key`/`model` override the saved values (use the unsaved field contents).
 * Counts toward usage like any other call.
 */
export async function testProvider(
  provider: 'groq' | 'gemini',
  override: { key?: string; model?: string } = {},
): Promise<ProviderCheck[]> {
  const key = override.key?.trim() || (provider === 'groq' ? await getGroqKey() : await getApiKey());
  if (!key) return [{ label: 'Text', ok: false, detail: 'No API key saved or entered.' }];
  const model =
    override.model?.trim() || (provider === 'groq' ? await getGroqModel() : await getModel());
  const call = (text: string, image?: string) =>
    provider === 'groq'
      ? callGroq(model, key, text, image, 'image/png')
      : callGemini(model, key, text, image, 'image/png');
  const checks: ProviderCheck[] = [];
  for (const [label, text, image] of [
    ['Text', 'Hello, how are you?', undefined],
    ['Image', 'What is in this image?', TEST_PNG],
  ] as const) {
    const r = await call(text, image);
    checks.push({ label, ok: r.ok, detail: r.ok ? 'OK' : r.message });
  }
  return checks;
}

type Posted = { res: Response } | { fail: CallResult };

async function post(url: string, headers: Record<string, string>, body: unknown, external?: AbortSignal): Promise<Posted> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (external?.aborted) ctrl.abort();
  else external?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { res };
  } catch (e) {
    if (external?.aborted) throw new AnalysisCancelled();
    return {
      fail: { ok: false, status: 0, message: e instanceof Error && e.name === 'AbortError' ? 'Timed out' : 'Network error' },
    };
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onAbort);
  }
}

/** Never echoes the request (it contains the key); surfaces only the API's message. */
async function readError(res: Response): Promise<CallResult> {
  let message = `HTTP ${res.status}`;
  try {
    const err = await res.json();
    if (err?.error?.message) message += `: ${String(err.error.message).slice(0, 200)}`;
  } catch {}
  return { ok: false, status: res.status, message };
}

async function callGroq(
  model: string,
  key: string,
  text: string,
  imageBase64: string | undefined,
  mime: string,
  signal?: AbortSignal,
): Promise<CallResult> {
  const content: Record<string, unknown>[] = [{ type: 'text', text: `${text}\nRespond with JSON only.` }];
  if (imageBase64) content.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } });
  const posted = await post(
    GROQ_URL,
    { Authorization: `Bearer ${key}` },
    {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      response_format: { type: 'json_object' },
      temperature: TEMPERATURE,
    },
    signal,
  );
  if ('fail' in posted) return posted.fail;
  const { res } = posted;
  if (!res.ok) return readError(res);
  const json = await res.json();
  await recordUsage('groq', Number(json?.usage?.total_tokens));
  const out: string = json?.choices?.[0]?.message?.content ?? '';
  return out ? { ok: true, text: out } : { ok: false, status: 0, message: 'Empty response' };
}

async function callGemini(
  model: string,
  key: string,
  text: string,
  imageBase64: string | undefined,
  mime: string,
  signal?: AbortSignal,
): Promise<CallResult> {
  const parts: Record<string, unknown>[] = [{ text }];
  if (imageBase64) parts.push({ inline_data: { mime_type: mime, data: imageBase64 } });
  const posted = await post(
    `${GEMINI_URL_BASE}/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': key },
    {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: TEMPERATURE },
    },
    signal,
  );
  if ('fail' in posted) return posted.fail;
  const { res } = posted;
  if (!res.ok) return readError(res);
  const json = await res.json();
  await recordUsage('gemini', Number(json?.usageMetadata?.totalTokenCount));
  const out: string = (json?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('');
  return out ? { ok: true, text: out } : { ok: false, status: 0, message: 'Empty response (the image may have been blocked).' };
}
