import { buildContext, confirmIntent, describeAction, isRisky, type Action, type Turn } from '@/domain/assistant';
import { toKey } from '@/domain/date';
import { friendlyError, UserError } from '@/domain/errors';
import { applyAction } from '@/services/assistantActions';
import { askAssistant } from '@/services/assistant';
import { AnalysisCancelled } from '@/services/mealAnalyzer';
import { getMuted, setMuted, speak, stopSpeaking } from '@/services/speak';
import { useAssistantStore, type Chip } from '@/store/useAssistantStore';
import { useMealStore } from '@/store/useMealStore';
import { useRoutineStore } from '@/store/useRoutineStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useUnitStore } from '@/store/useUnitStore';
import { useWeightStore } from '@/store/useWeightStore';

const store = () => useAssistantStore.getState();
/** friendlyError, worded for Atomic (no "the AI"). */
const errorText = (e: unknown, fallback?: string) => friendlyError(e, fallback).replace(/\bThe AI\b/g, 'Atomic');
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** A request that is still running after this long is abandoned with a visible error (never an endless spinner). */
export const WATCHDOG_MS = 90_000;
const SLOW_MSG = 'That took too long. Please try again.';

let history: Turn[] = [];
let abort: AbortController | null = null;
let speakToken = 0;
let noteShown = false;

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

/** Reads `text` aloud unless muted; the button shows "speaking" meanwhile. */
async function say(text: string): Promise<void> {
  if (store().muted || !text.trim()) return;
  const token = ++speakToken;
  store().set({ phase: 'speaking' });
  try {
    await speak(text, (note) => {
      const ex = store().exchange;
      if (noteShown || !ex || token !== speakToken) return;
      noteShown = true;
      store().set({ exchange: { ...ex, chips: [...ex.chips, { id: newId(), text: note, ok: false }] } });
    });
  } catch (e) {
    console.warn('Speaking failed', e);
  }
  if (token === speakToken && store().phase === 'speaking') store().set({ phase: 'idle' });
}

/** Shows what Atomic heard while it works. */
function listening(heard: string) {
  store().set({ exchange: { heard, reply: null, chips: [] }, phase: 'thinking', undo: null });
}

function respond(reply: string, chips: Chip[] = [], error = false) {
  const heard = store().exchange?.heard ?? '';
  store().set({ exchange: { heard, reply, chips, error }, phase: 'idle' });
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
      console.warn('Atomic action failed', a.type, e);
      const msg = e instanceof UserError ? e.message : errorText(e, 'That did not work. Please try again.');
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

const remember = (user: string | null, assistant: string) => {
  history = [...history, ...(user ? [{ role: 'user' as const, text: user }] : []), { role: 'assistant' as const, text: assistant }].slice(-8);
};

/** Starts a cancellable unit of work with a watchdog; every outcome ends in respond() or a silent cancel. */
async function guarded(work: (signal: AbortSignal) => Promise<void>): Promise<void> {
  const ctrl = new AbortController();
  abort = ctrl;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, WATCHDOG_MS);
  try {
    await work(ctrl.signal);
  } catch (e) {
    if (e instanceof AnalysisCancelled) {
      if (timedOut) {
        respond(SLOW_MSG, [], true);
        say(SLOW_MSG);
      } else if (store().phase === 'thinking') {
        store().set({ phase: 'idle' });
      }
      return;
    }
    console.warn('Atomic failed', e);
    const msg = errorText(e, 'Atomic could not answer. Please try again.');
    respond(msg, [], true);
    say(msg);
  } finally {
    clearTimeout(timer);
    if (abort === ctrl) abort = null;
  }
}

export async function submit(raw: string): Promise<void> {
  const text = raw.trim();
  if (!text || store().phase === 'thinking') return;
  interruptSpeech();

  const pending = store().pending;
  if (pending) {
    const intent = confirmIntent(text);
    if (intent === 'yes') return confirmPending();
    if (intent === 'no') return cancelPending();
    store().set({ pending: null }); // a new request replaces the old question
  }

  listening(text);
  await guarded(async (signal) => {
    const now = new Date();
    const routines = useRoutineStore.getState();
    const context = buildContext({
      routines: routines.routines,
      done: routines.done,
      tasks: useTaskStore.getState().tasks,
      meals: useMealStore.getState().meals,
      goals: useMealStore.getState().goals,
      weights: useWeightStore.getState().entries,
      unit: useUnitStore.getState().unit,
      now,
    });
    const parsed = await askAssistant({ text, context, history, now, signal });
    const today = toKey(now);
    const safe = parsed.actions.filter((a) => !isRisky(a));
    const risky = parsed.actions.filter(isRisky);

    const batch = await runBatch(safe, now, signal);
    const chips: Chip[] = [...batch.chips, ...parsed.skipped.map((s) => ({ id: newId(), text: s, ok: false }))];
    const labels = risky.map((a) => describeAction(a, today, useUnitStore.getState().unit));
    const reply = parsed.reply || (chips.some((c) => c.ok) ? 'Done.' : 'I could not do that.');

    respond(reply, chips);
    store().set({ pending: risky.length ? { actions: risky, labels } : null });
    offerUndo(batch.undos);
    remember(
      text,
      `${reply}${chips.length ? ` [${chips.map((c) => c.text).join('; ')}]` : ''}${labels.length ? ` [awaiting confirmation: ${labels.join('; ')}]` : ''}`,
    );

    const spoken = [reply, ...batch.spoken, ...batch.failed.slice(0, 1), risky.length ? 'Please confirm.' : '']
      .filter(Boolean)
      .join(' ');
    say(spoken);
  });
}

export async function confirmPending(): Promise<void> {
  const pending = store().pending;
  if (!pending) return;
  store().set({ pending: null, phase: 'thinking' });
  await guarded(async (signal) => {
    const batch = await runBatch(pending.actions, new Date(), signal);
    const reply = batch.chips.some((c) => c.ok) ? 'Done.' : 'I could not do that.';
    respond(reply, batch.chips);
    offerUndo(batch.undos);
    remember(null, `${reply} [${batch.chips.map((c) => c.text).join('; ')}]`);
    say([reply, ...batch.failed.slice(0, 1)].join(' '));
  });
}

export function cancelPending(): void {
  if (!store().pending) return;
  store().set({ pending: null });
  respond('Okay, I left it as it was.');
  remember(null, 'Okay, I left it as it was.');
  say('Okay, I left it as it was.');
}

export async function undoLast(): Promise<void> {
  const u = store().undo;
  if (!u) return;
  store().set({ undo: null });
  try {
    await u.run();
    respond('Undone.');
    remember(null, 'Undone the last changes.');
    say('Undone.');
  } catch (e) {
    console.warn('Undo failed', e);
    respond('Could not undo that.', [], true);
  }
}

/** Stops a request that is in flight (finished changes stay). */
export function cancelRequest(): void {
  abort?.abort();
}

/** Opens Atomic with a clean slate (earlier turns are still remembered for follow-ups within the session). */
export function openAssistant(): void {
  noteShown = false;
  store().set({ open: true, exchange: null, pending: null, undo: null, phase: 'idle' });
}

/** Closing stops speech and any request in flight; changes already made stay. */
export function closeAssistant(): void {
  abort?.abort();
  abort = null;
  interruptSpeech();
  store().set({ open: false, phase: 'idle', pending: null });
}

export const stopAssistantSpeech = interruptSpeech;

/** Shows a voice/transcription failure (not spoken). */
export function reportError(e: unknown, fallback: string): void {
  respond(errorText(e, fallback), [], true);
}
