import * as SecureStore from 'expo-secure-store';
import { recordUsage } from '@/services/aiUsage';
import { parseAnalysis, type InputType, type MealAnalysis } from '@/domain/meal';

const KEY_STORE = 'gemini.apiKey';
const GROQ_KEY_STORE = 'groq.apiKey';
const GROQ_MODEL_STORE = 'groq.model';
const MODEL_STORE = 'gemini.model';
// Model id taken from the user's Google doc snippet. Editable in the Meals screen.
export const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b'; // per Groq vision docs
export const DEFAULT_MODEL = 'gemini-3.8-flash';
const TIMEOUT_MS = 45_000;
// Other free-tier vision-capable Gemini models, tried in order after the selected one.
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

export const SYSTEM_PROMPT = `You are an expert, highly precise digital dietitian and nutrition analysis AI. Your task is to analyze a meal input—which may consist of a raw image, an optional user text note, or a product name/barcode string—to calculate calories, protein, carbs and fat as accurately as possible.

USER PROFILE: The user is a pure vegetarian (lacto-vegetarian): NO meat, poultry, fish, seafood or EGGS, and no gelatin. Dairy is fine. Never identify an ingredient as meat, fish or egg; if something looks ambiguous, choose the vegetarian interpretation (e.g. paneer, tofu, soya chunks, dal, rajma, chole, curd, besan). Common home-style Indian and everyday vegetarian dishes are likely.

ACCURACY OVER CAUTION: The user tracks intake closely. Do NOT pad or overestimate. Give the single most likely value, not a worst case. Never add a safety margin.

Follow these strict operational rules based on the input type:

1. BARCODE/PRODUCT: If the user provides a barcode or product name in the text note, prioritize it over visual elements. Treat it as a packaged/branded item and use the known label values for that product, scaled to the user's stated portion size. If you do not recognise it, say so in assumptions_made and lower the confidence score.

2. PRIORITY OF TEXT NOTES: For non-packaged foods, treat the user's text note as absolute fact. If the note says "cooked in 1 tsp ghee" or "200g paneer," use those exact numbers over what you see visually. Use the image to identify unlisted ingredients and estimate remaining portion sizes.

3. INGREDIENT BREAKDOWN: Deconstruct the meal into its individual components. Do not group them into broad categories (e.g., do not just say "Thali"; list "Roti, Dal, Paneer sabzi, Rice, Curd").

4. QUANTITY ESTIMATION: For every item identified visually without precise user text:
   - Estimate the weight in grams or volume in standard measures (tbsp, cups, pieces).
   - Use plate, bowl and utensil scale cues in the image to judge size.
   - Use cooked-weight nutrition values for cooked foods (cooked rice, cooked dal), not dry-weight values.
   - If a portion is ambiguous, choose the typical single-serving size. Do not inflate it.

5. COOKING FAT: Add a separate cooking-oil/ghee line item ONLY when the food is clearly fried, sautéed or visibly oily/glossy. Default to 1 tsp (5 g, about 45 kcal) for home-style sautéing and 1 tbsp only for deep-fried or clearly oily dishes. Do not add oil to plain boiled, steamed, raw, baked-dry or packaged items, or when the user states the oil used. Add a sauce/dressing line only when one is visible.

6. OUTPUT STRUCTURE: Return your analysis strictly in a clean, parseable JSON format containing:
   - "input_type": ("barcode", "image_only", or "image_and_note")
   - "meal_confidence_score": (1-10 rating of how clearly the food or product is identified)
   - "ingredients": An array of objects, each containing "name", "estimated_quantity", "calories", "protein_g", "carbs_g" and "fat_g" (numbers).
   - "totals": An object containing "total_calories", "total_protein_g", "total_carbs_g" and "total_fat_g".
   - "assumptions_made": A brief list of the weights or fats you had to guess, or of a product you could not match.

Do not include conversational filler. Start your response directly with the structured data.`;

export const getApiKey = () => SecureStore.getItemAsync(KEY_STORE);
export const setApiKey = (key: string) => SecureStore.setItemAsync(KEY_STORE, key.trim());
export const clearApiKey = () => SecureStore.deleteItemAsync(KEY_STORE);
export const getModel = async () => (await SecureStore.getItemAsync(MODEL_STORE)) || DEFAULT_MODEL;
export const setModel = (m: string) =>
  m.trim() ? SecureStore.setItemAsync(MODEL_STORE, m.trim()) : SecureStore.deleteItemAsync(MODEL_STORE);

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

const TRANSIENT = new Set([0, 429, 500, 502, 503, 504]);

/**
 * Tries Groq first (if a key is saved), then Gemini models (if a key is saved).
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
  if (!input.imageBase64 && !barcode && !note) throw new Error('Add a photo, a barcode/product, or a note.');

  const [groqKey, geminiKey] = await Promise.all([getGroqKey(), getApiKey()]);
  ensureActive();
  if (!groqKey && !geminiKey) throw new Error('Add a Groq or Gemini API key in Settings first.');

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
    const primary = await getModel();
    for (const model of [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)]) {
      targets.push({ label: `gemini:${model}`, call: (sig) => callGemini(model, geminiKey, text, input.imageBase64, mime, sig) });
    }
  }

  let lastError = new Error('Analysis failed.');
  for (const target of targets) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
      ensureActive();
      const r = await target.call(signal);
      ensureActive();
      if (r.ok) {
        try {
          return { ...parseAnalysis(r.text, inputType), model: target.label };
        } catch (e) {
          lastError = new Error(`${target.label}: ${e instanceof Error ? e.message : String(e)}`);
          break; // bad output: next target rather than the same one
        }
      }
      lastError = new Error(`${target.label}: ${r.message}`);
      if (r.status === 404) break; // unknown model: next one
      if (!TRANSIENT.has(r.status)) {
        // Bad key / bad request: another model on the same provider won't help, but another provider might.
        break;
      }
    }
  }
  throw new Error(`${lastError.message} (tried ${targets.map((t) => t.label).join(', ')})`);
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
    'https://api.groq.com/openai/v1/chat/completions',
    { Authorization: `Bearer ${key}` },
    {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
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
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': key },
    {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
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
