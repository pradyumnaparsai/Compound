import {
  ASSISTANT_PROMPT,
  HISTORY_TURNS,
  normalizeHistory,
  parseAssistantReply,
  type AssistantContext,
  type ParsedReply,
  type Turn,
} from '@/domain/assistant';
import { AnalysisFailed, UserError } from '@/domain/errors';
import { recordUsage } from '@/services/aiUsage';
import {
  AnalysisCancelled,
  getApiKey,
  getGroqKey,
  getGroqModel,
  getModel,
  post,
  readError,
  type CallResult,
} from '@/services/mealAnalyzer';
import { GEMINI_URL_BASE, GROQ_URL, MAX_ATTEMPTS, RETRY_DELAY_MS, TRANSIENT_STATUSES } from '@/services/mealAnalyzerConstants';

type Ask = { text: string; context: AssistantContext; history: Turn[]; now: Date; signal?: AbortSignal };

const TEMPERATURE = 0.2;

const userMessage = (text: string, context: AssistantContext) =>
  `${context.text}\n\nUser said: ${JSON.stringify(text)}\nRespond with JSON only.`;

/**
 * One cheap text-only call: compact context + the last few turns + the new request.
 * Groq first, Gemini as fallback (same keys and models as meal analysis). Tokens are counted in AI usage.
 */
export async function askAssistant({ text, context, history, now, signal }: Ask): Promise<ParsedReply & { model: string }> {
  const ensureActive = () => {
    if (signal?.aborted) throw new AnalysisCancelled();
  };
  ensureActive();
  const [groqKey, geminiKey] = await Promise.all([getGroqKey(), getApiKey()]);
  ensureActive();
  if (!groqKey && !geminiKey) throw new UserError('Add a Groq or Gemini API key in Meal settings to use the assistant.');

  const recent = normalizeHistory(history, HISTORY_TURNS * 2);
  const targets: { label: string; call: () => Promise<CallResult> }[] = [];
  if (groqKey) {
    const model = await getGroqModel();
    targets.push({ label: `groq:${model}`, call: () => callGroq(model, groqKey, text, context, recent, signal) });
  }
  if (geminiKey) {
    const model = await getModel();
    targets.push({ label: `gemini:${model}`, call: () => callGemini(model, geminiKey, text, context, recent, signal) });
  }

  let lastMessage = 'Assistant failed.';
  let lastStatus = 0;
  for (const target of targets) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      ensureActive();
      const r = await target.call();
      ensureActive();
      if (r.ok) {
        try {
          return { ...parseAssistantReply(r.text, context, now), model: target.label };
        } catch (e) {
          lastMessage = `${target.label}: ${e instanceof Error ? e.message : String(e)}`;
          lastStatus = -1;
          break; // unusable output: try the next provider rather than the same one
        }
      }
      lastMessage = `${target.label}: ${r.message}`;
      lastStatus = r.status;
      console.warn('Assistant target failed:', lastMessage);
      if (!TRANSIENT_STATUSES.has(r.status)) break;
    }
  }
  throw new AnalysisFailed(`${lastMessage} (tried ${targets.map((t) => t.label).join(', ')})`, lastStatus);
}

async function callGroq(
  model: string,
  key: string,
  text: string,
  context: AssistantContext,
  history: Turn[],
  signal?: AbortSignal,
): Promise<CallResult> {
  const posted = await post(
    GROQ_URL,
    { Authorization: `Bearer ${key}` },
    {
      model,
      messages: [
        { role: 'system', content: ASSISTANT_PROMPT },
        ...history.map((h) => ({ role: h.role, content: h.text })),
        { role: 'user', content: userMessage(text, context) },
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
  context: AssistantContext,
  history: Turn[],
  signal?: AbortSignal,
): Promise<CallResult> {
  const posted = await post(
    `${GEMINI_URL_BASE}/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': key },
    {
      systemInstruction: { parts: [{ text: ASSISTANT_PROMPT }] },
      contents: [
        ...history.map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
        { role: 'user', parts: [{ text: userMessage(text, context) }] },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: TEMPERATURE },
    },
    signal,
  );
  if ('fail' in posted) return posted.fail;
  const { res } = posted;
  if (!res.ok) return readError(res);
  const json = await res.json();
  await recordUsage('gemini', Number(json?.usageMetadata?.totalTokenCount));
  const out: string = (json?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  return out ? { ok: true, text: out } : { ok: false, status: 0, message: 'Empty response' };
}
