import { buildContext, confirmIntent, describeAction, isRisky, type Action, type Turn } from '@/domain/assistant';
import { toKey } from '@/domain/date';
import { friendlyError, UserError } from '@/domain/errors';
import { applyAction } from '@/services/assistantActions';
import { askAssistant } from '@/services/assistant';
import { AnalysisCancelled } from '@/services/mealAnalyzer';
import { getMuted, setMuted, speak, stopSpeaking } from '@/services/speak';
import { useAssistantStore, type Chip, type Msg } from '@/store/useAssistantStore';
import { useMealStore } from '@/store/useMealStore';
import { useRoutineStore } from '@/store/useRoutineStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useWeightStore } from '@/store/useWeightStore';

const store = () => useAssistantStore.getState();
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

let history: Turn[] = [];
let abort: AbortController | null = null;
let speakToken = 0;

export async function initAssistant(): Promise<void> {
  store().set({ muted: await getMuted() });
}

export function toggleMute(): void {
  const muted = !store().muted;
  store().set({ muted });
  setMuted(muted);
  if (muted) interruptSpeech();
}

function interruptSpeech() {
  speakToken++;
  stopSpeaking();
  if (store().phase === 'speaking') store().set({ phase: 'idle' });
}

/** Reads `text` aloud unless muted; the orb shows "speaking" meanwhile. */
async function say(text: string): Promise<void> {
  if (store().muted || !text.trim()) return;
  const token = ++speakToken;
  store().set({ phase: 'speaking' });
  await speak(text);
  if (token === speakToken && store().phase === 'speaking') store().set({ phase: 'idle' });
}

function assistantMsg(text: string, extra: Partial<Msg> = {}) {
  store().push({ id: newId(), role: 'assistant', text, ...extra });
}

type Batch = { chips: Chip[]; spoken: string[]; undos: (() => Promise<void>)[]; failed: string[] };

/** Runs actions one after another; one failure doesn't stop the rest. */
async function runBatch(actions: Action[], now: Date, signal: AbortSignal): Promise<Batch> {
  const batch: Batch = { chips: [], spoken: [], undos: [], failed: [] };
  for (const a of actions) {
    if (signal.aborted) throw new AnalysisCancelled();
    try {
      const r = await applyAction(a, now, signal);
      batch.chips.push({ id: newId(), text: r.text, ok: true });
      if (r.spoken) batch.spoken.push(r.spoken);
      if (r.undo) batch.undos.push(r.undo);
    } catch (e) {
      if (e instanceof AnalysisCancelled) throw e;
      console.warn('Assistant action failed', a.type, e);
      const msg = e instanceof UserError ? e.message : friendlyError(e, 'That did not work. Please try again.');
      batch.chips.push({ id: newId(), text: msg, ok: false });
      batch.failed.push(msg);
    }
  }
  return batch;
}

function offerUndo(undos: (() => Promise<void>)[]) {
  store().set({
    undo: undos.length
      ? {
          count: undos.length,
          run: async () => {
            for (const u of [...undos].reverse()) await u();
          },
        }
      : null,
  });
}

export async function submit(raw: string): Promise<void> {
  const text = raw.trim();
  if (!text || store().phase === 'thinking') return;
  interruptSpeech();
  store().push({ id: newId(), role: 'user', text });

  const pending = store().pending;
  if (pending) {
    const intent = confirmIntent(text);
    if (intent === 'yes') return confirmPending();
    if (intent === 'no') return cancelPending();
    store().set({ pending: null }); // a new request replaces the old question
  }

  const ctrl = new AbortController();
  abort = ctrl;
  store().set({ phase: 'thinking', undo: null });
  try {
    const now = new Date();
    const routines = useRoutineStore.getState();
    const context = buildContext({
      routines: routines.routines,
      done: routines.done,
      tasks: useTaskStore.getState().tasks,
      meals: useMealStore.getState().meals,
      goals: useMealStore.getState().goals,
      weights: useWeightStore.getState().entries,
      now,
    });
    const parsed = await askAssistant({ text, context, history, now, signal: ctrl.signal });
    const today = toKey(now);
    const safe = parsed.actions.filter((a) => !isRisky(a));
    const risky = parsed.actions.filter(isRisky);

    const batch = await runBatch(safe, now, ctrl.signal);
    const chips: Chip[] = [
      ...batch.chips,
      ...parsed.skipped.map((s) => ({ id: newId(), text: s, ok: false })),
    ];
    const labels = risky.map((a) => describeAction(a, today));
    const reply = parsed.reply || (chips.some((c) => c.ok) ? 'Done.' : 'I could not do that.');

    assistantMsg(reply, { chips });
    store().set({
      phase: 'idle',
      pending: risky.length ? { actions: risky, labels } : null,
    });
    offerUndo(batch.undos);

    history = [
      ...history,
      { role: 'user' as const, text },
      {
        role: 'assistant' as const,
        text: `${reply}${chips.length ? ` [${chips.map((c) => c.text).join('; ')}]` : ''}${labels.length ? ` [awaiting confirmation: ${labels.join('; ')}]` : ''}`,
      },
    ].slice(-8);

    const spoken = [reply, ...batch.spoken, ...batch.failed.slice(0, 1), risky.length ? 'Please confirm.' : '']
      .filter(Boolean)
      .join(' ');
    say(spoken);
  } catch (e) {
    if (e instanceof AnalysisCancelled) {
      store().set({ phase: 'idle' });
      return;
    }
    console.warn('Assistant failed', e);
    const msg = friendlyError(e, 'The assistant could not answer. Please try again.');
    assistantMsg(msg, { error: true });
    store().set({ phase: 'idle' });
    say(msg);
  } finally {
    if (abort === ctrl) abort = null;
  }
}

export async function confirmPending(): Promise<void> {
  const pending = store().pending;
  if (!pending) return;
  store().set({ pending: null, phase: 'thinking' });
  const ctrl = new AbortController();
  abort = ctrl;
  try {
    const batch = await runBatch(pending.actions, new Date(), ctrl.signal);
    const ok = batch.chips.some((c) => c.ok);
    const reply = ok ? 'Done.' : 'I could not do that.';
    assistantMsg(reply, { chips: batch.chips });
    store().set({ phase: 'idle' });
    offerUndo(batch.undos);
    history = [...history, { role: 'assistant' as const, text: `${reply} [${batch.chips.map((c) => c.text).join('; ')}]` }].slice(-8);
    say([reply, ...batch.failed.slice(0, 1)].join(' '));
  } catch (e) {
    store().set({ phase: 'idle' });
    if (!(e instanceof AnalysisCancelled)) assistantMsg(friendlyError(e), { error: true });
  } finally {
    if (abort === ctrl) abort = null;
  }
}

export function cancelPending(): void {
  if (!store().pending) return;
  store().set({ pending: null });
  assistantMsg('Okay, I left it as it was.');
  history = [...history, { role: 'assistant' as const, text: 'Okay, I left it as it was.' }].slice(-8);
  say('Okay, I left it as it was.');
}

export async function undoLast(): Promise<void> {
  const u = store().undo;
  if (!u) return;
  store().set({ undo: null });
  try {
    await u.run();
    assistantMsg('Undone.');
    history = [...history, { role: 'assistant' as const, text: 'Undone the last changes.' }].slice(-8);
    say('Undone.');
  } catch (e) {
    console.warn('Undo failed', e);
    assistantMsg('Could not undo that.', { error: true });
  }
}

/** Closing the panel stops listening replies, speech and any request in flight (finished changes stay). */
export function closeAssistant(): void {
  abort?.abort();
  abort = null;
  interruptSpeech();
  store().set({ open: false, phase: 'idle' });
}

export function clearConversation(): void {
  history = [];
  store().set({ messages: [], pending: null, undo: null });
}

export const stopAssistantSpeech = interruptSpeech;

/** Shows a voice/transcription failure in the conversation (not spoken). */
export function reportError(e: unknown, fallback: string): void {
  assistantMsg(friendlyError(e, fallback), { error: true });
}
