// Pure logic for the voice assistant: builds the compact context sent to the model, validates its untrusted
// JSON reply into typed actions (resolving fuzzy references to real ids), and decides what needs confirmation.
import { addDays, fromKey, toKey, weekday } from './date';
import { goalLabel } from './goal';
import { dayTotals, isMealSlot, slotForTime, slotLabel, stripFences, type Goals, type Meal, type MealSlot } from './meal';
import { completionKey, isScheduled, recurrenceLabel } from './recurrence';
import type { Routine, Task } from './types';
import type { WeightEntry } from './weight';

export type Action =
  | { type: 'add_routine'; title: string; days: number[] | null } // null = every day
  | { type: 'add_task'; title: string; date: string }
  | { type: 'log_meal'; description: string; slot: MealSlot; date: string }
  | { type: 'set_routine_done'; id: string; title: string; date: string; done: boolean }
  | { type: 'set_task_done'; id: string; title: string; done: boolean }
  | { type: 'reschedule_task'; id: string; title: string; date: string }
  | { type: 'log_weight'; kg: number; date: string }
  | { type: 'set_goals'; calories: number; proteinG: number }
  | { type: 'archive_routine'; id: string; title: string }
  | { type: 'delete_task'; id: string; title: string }
  | { type: 'delete_meal'; id: string; title: string };

export type RefItem = { ref: string; id: string; title: string };

export type AssistantContext = {
  text: string;
  routines: RefItem[];
  tasks: RefItem[];
  meals: RefItem[];
  goals: Goals | null;
};

export type ContextInput = {
  routines: Routine[];
  done: Set<string>;
  tasks: Task[];
  meals: Meal[];
  goals: Goals | null;
  weights: WeightEntry[];
  now: Date;
};

export type ParsedReply = { reply: string; actions: Action[]; skipped: string[] };

export const MAX_ACTIONS = 12;
const MAX_ROUTINES = 40;
const MAX_TASKS = 40;
const MAX_MEALS = 20;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const ASSISTANT_PROMPT = `You are Atomic, the voice assistant inside Compound, a habit, task and meal tracking app. The user speaks to you; the text may contain speech-recognition mistakes. Turn each request into app actions plus a short spoken reply.

Reply with JSON only: {"reply": string, "actions": Action[]}
- reply: one or two short, friendly sentences of plain text (it is read aloud). Say what you did, or ask ONE short clarifying question. Never state calories or macros for a logged meal (they are computed after logging).
- Actions (use only these; "ref" is an id from the lists in the context such as r2, t1, m3, or the exact title):
  {"type":"add_routine","title":str,"days":[0-6]}  days: 0=Sun..6=Sat, omit for every day
  {"type":"add_task","title":str,"date":"YYYY-MM-DD"}  one-off to-do, omit date for today
  {"type":"log_meal","description":str,"slot":"breakfast|lunch|snacks|dinner","date":"YYYY-MM-DD"}  description = what the user ate with quantities; omit slot to use the time of day, omit date for today
  {"type":"set_routine_done","ref":str,"done":bool,"date":"YYYY-MM-DD"}  date defaults to today
  {"type":"set_task_done","ref":str,"done":bool}
  {"type":"reschedule_task","ref":str,"date":"YYYY-MM-DD"}
  {"type":"log_weight","kg":number,"date":"YYYY-MM-DD"}
  {"type":"set_goals","calories":number,"protein_g":number}  daily meal goals; give only what the user changes
  {"type":"archive_routine","ref":str}
  {"type":"delete_task","ref":str}
  {"type":"delete_meal","ref":str}
Rules:
- Resolve "tomorrow", "Friday", "next Monday" with the calendar in the context.
- Several things in one sentence mean several actions; use one log_meal per distinct meal.
- Never invent routines, tasks or meals. If a reference is unclear or a needed detail is missing, ask in reply with "actions": [].
- Use archive_routine, delete_* and set_goals only when the user clearly asks for it.
- If the user only chats or asks a question (e.g. how many calories are left), answer in reply using the context, with "actions": [].`;

/** Hint for Whisper. Kept short: on near-silent audio Whisper tends to echo its prompt back. */
export const ASSISTANT_VOICE_HINT = 'Add task, routine, meal, breakfast, lunch, dinner, tomorrow, kilograms, calories, protein.';

/**
 * Extra Groq request fields for the chat model. Qwen 3.8 otherwise "thinks" for many seconds before answering,
 * which feels like no response; JSON mode needs the reasoning hidden (see Groq's reasoning docs).
 */
export function groqExtras(model: string): Record<string, string> {
  return /^qwen\/qwen3\.8/i.test(model) ? { reasoning_effort: 'none', reasoning_format: 'hidden' } : {};
}

const clean = (s: string) => s.replace(/[\r\n|]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The model gets ids and titles only (no history, no macros per item) to keep every call cheap. */
export function buildContext(input: ContextInput): AssistantContext {
  const today = toKey(input.now);
  const routineItems = input.routines
    .filter((r) => !r.archivedAt || r.archivedAt > today)
    .slice(0, MAX_ROUTINES)
    .map((r, i) => ({ r, ref: `r${i + 1}` }));
  const taskItems = input.tasks
    .filter((t) => !t.completedAt)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MAX_TASKS)
    .map((t, i) => ({ t, ref: `t${i + 1}` }));
  const mealItems = input.meals
    .filter((m) => m.date >= addDays(today, -1))
    .slice(-MAX_MEALS)
    .map((m, i) => ({ m, ref: `m${i + 1}` }));

  const calendar = Array.from({ length: 7 }, (_, i) => {
    const k = addDays(today, i);
    return `${i === 0 ? 'today' : i === 1 ? 'tomorrow' : FULL_DAY_NAMES[weekday(k)]}=${k}`;
  }).join(', ');
  const eaten = dayTotals(input.meals.filter((m) => m.date === today));
  const lastWeight = input.weights.length ? input.weights[input.weights.length - 1] : null;

  const lines = [
    `Today: ${today} (${FULL_DAY_NAMES[weekday(today)]}), time ${String(input.now.getHours()).padStart(2, '0')}:${String(input.now.getMinutes()).padStart(2, '0')}`,
    `Calendar: ${calendar}`,
    input.goals
      ? `Meal goals: ${input.goals.calories} kcal, ${input.goals.proteinG} g protein. Eaten today: ${eaten.calories} kcal, ${eaten.proteinG} g protein`
      : `Meal goals: not set. Eaten today: ${eaten.calories} kcal, ${eaten.proteinG} g protein`,
    lastWeight ? `Last weight: ${lastWeight.kg} kg on ${lastWeight.date}` : 'Last weight: none',
    'Routines (ref|title|schedule|today):',
    ...(routineItems.length
      ? routineItems.map(({ r, ref }) => {
          const state = isScheduled(r, today) ? (input.done.has(completionKey(r.id, today)) ? 'done' : 'todo') : 'not scheduled';
          const goal = r.goal ? ` (auto: ${goalLabel(r.goal)})` : '';
          return `${ref}|${clean(r.title)}${goal}|${recurrenceLabel(r.recurrence)}|${state}`;
        })
      : ['none']),
    'Open tasks (ref|title|due):',
    ...(taskItems.length ? taskItems.map(({ t, ref }) => `${ref}|${clean(t.title)}|${t.date}`) : ['none']),
    'Meals yesterday and today (ref|date|slot|title):',
    ...(mealItems.length ? mealItems.map(({ m, ref }) => `${ref}|${m.date}|${m.slot}|${clean(m.title)}`) : ['none']),
  ];
  return {
    text: lines.join('\n'),
    routines: routineItems.map(({ r, ref }) => ({ ref, id: r.id, title: r.title })),
    tasks: taskItems.map(({ t, ref }) => ({ ref, id: t.id, title: t.title })),
    meals: mealItems.map(({ m, ref }) => ({ ref, id: m.id, title: m.title })),
    goals: input.goals,
  };
}

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

export type RefResult = { item: RefItem } | { reason: 'missing' | 'ambiguous' };

/** Resolves a model-supplied reference: short id (r2), exact title, or the unique best fuzzy title match. */
export function resolveRef(ref: unknown, items: RefItem[]): RefResult {
  if (typeof ref !== 'string' || !ref.trim()) return { reason: 'missing' };
  const raw = ref.trim();
  const byRef = items.find((i) => i.ref === raw.toLowerCase());
  if (byRef) return { item: byRef };
  const a = words(raw);
  if (a.length === 0) return { reason: 'missing' };
  const exact = items.filter((i) => words(i.title).join(' ') === a.join(' '));
  if (exact.length === 1) return { item: exact[0] };
  if (exact.length > 1) return { reason: 'ambiguous' };

  const aSet = new Set(a);
  const scored = items
    .map((item) => {
      const b = words(item.title);
      const bSet = new Set(b);
      const inter = [...aSet].filter((w) => bSet.has(w)).length;
      const containment = inter / Math.min(aSet.size, bSet.size || 1);
      const jaccard = inter / (aSet.size + bSet.size - inter || 1);
      return { item, containment, jaccard };
    })
    .filter((s) => s.containment >= 0.67)
    .sort((x, y) => y.containment - x.containment || y.jaccard - x.jaccard);
  if (scored.length === 0) return { reason: 'missing' };
  if (scored.length > 1 && scored[0].containment === scored[1].containment && scored[0].jaccard === scored[1].jaccard) {
    return { reason: 'ambiguous' };
  }
  return { item: scored[0].item };
}

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Date key for a model value. `fallback` when absent; null when present but not a real, sensible date. */
export function resolveDate(v: unknown, today: string, fallback: string | null = today): string | null {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (s === 'today') return today;
  if (s === 'tomorrow') return addDays(today, 1);
  if (s === 'yesterday') return addDays(today, -1);
  if (!KEY_RE.test(s) || toKey(fromKey(s)) !== s) return null;
  return s >= addDays(today, -366) && s <= addDays(today, 730) ? s : null;
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function parseDays(v: unknown): number[] | null | undefined {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) return undefined;
  const valid = v.map(num).filter((d): d is number => d !== null && Number.isInteger(d) && d >= 0 && d <= 6);
  if (valid.length !== v.length) return undefined;
  const days = [...new Set(valid)];
  return days.length === 0 || days.length === 7 ? null : days.sort((a, b) => a - b);
}

/**
 * Validates the model's untrusted reply. Bad or unresolvable actions are dropped and listed in `skipped`
 * (the rest still run). Throws only when the reply is unusable as a whole.
 */
export function parseAssistantReply(raw: string, ctx: AssistantContext, now: Date): ParsedReply {
  let data: unknown;
  try {
    data = JSON.parse(stripFences(raw));
  } catch {
    throw new Error('The model did not return valid JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Unexpected response shape.');
  const o = data as Record<string, unknown>;
  const reply = str(o.reply, 400);
  const list = Array.isArray(o.actions) ? o.actions : [];
  if (!reply && list.length === 0) throw new Error('Unexpected response shape.');

  const today = toKey(now);
  const actions: Action[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  const push = (a: Action) => {
    const k = JSON.stringify(a);
    if (seen.has(k)) return;
    seen.add(k);
    actions.push(a);
  };
  const need = (items: RefItem[], ref: unknown, noun: string): RefItem | null => {
    const r = resolveRef(ref, items);
    if ('item' in r) return r.item;
    const name = typeof ref === 'string' && ref.trim() ? `"${str(ref, 40)}"` : '';
    skipped.push(r.reason === 'ambiguous' ? `More than one ${noun} matches ${name}` : `Could not find the ${noun} ${name}`.trim());
    return null;
  };

  for (const entry of list.slice(0, MAX_ACTIONS)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    switch (e.type) {
      case 'add_routine': {
        const title = str(e.title, 80);
        const days = parseDays(e.days);
        if (!title || days === undefined) {
          skipped.push('Could not understand the routine');
          break;
        }
        push({ type: 'add_routine', title, days });
        break;
      }
      case 'add_task': {
        const title = str(e.title, 120);
        const date = resolveDate(e.date, today);
        if (!title || !date) {
          skipped.push(title ? 'Could not understand the task date' : 'Could not understand the task');
          break;
        }
        push({ type: 'add_task', title, date });
        break;
      }
      case 'log_meal': {
        const description = str(e.description, 300);
        const date = resolveDate(e.date, today);
        if (!description || !date) {
          skipped.push(description ? 'Could not understand the meal date' : 'Could not understand the meal');
          break;
        }
        const slot = isMealSlot(e.slot) ? e.slot : slotForTime(now);
        push({ type: 'log_meal', description, slot, date });
        break;
      }
      case 'set_routine_done': {
        const item = need(ctx.routines, e.ref, 'routine');
        const date = resolveDate(e.date, today);
        if (!item) break;
        if (!date) {
          skipped.push('Could not understand the date');
          break;
        }
        push({ type: 'set_routine_done', id: item.id, title: item.title, date, done: e.done !== false });
        break;
      }
      case 'set_task_done': {
        const item = need(ctx.tasks, e.ref, 'task');
        if (item) push({ type: 'set_task_done', id: item.id, title: item.title, done: e.done !== false });
        break;
      }
      case 'reschedule_task': {
        const item = need(ctx.tasks, e.ref, 'task');
        const date = resolveDate(e.date, today, null);
        if (!item) break;
        if (!date) {
          skipped.push('Could not understand the new date');
          break;
        }
        push({ type: 'reschedule_task', id: item.id, title: item.title, date });
        break;
      }
      case 'log_weight': {
        const kg = num(e.kg);
        const date = resolveDate(e.date, today);
        if (kg === null || kg < 20 || kg > 400 || !date) {
          skipped.push('Could not understand the weight');
          break;
        }
        push({ type: 'log_weight', kg: Math.round(kg * 10) / 10, date });
        break;
      }
      case 'set_goals': {
        const calories = num(e.calories) ?? ctx.goals?.calories ?? null;
        const proteinG = num(e.protein_g) ?? ctx.goals?.proteinG ?? null;
        const given = num(e.calories) !== null || num(e.protein_g) !== null;
        if (!given || calories === null || proteinG === null || calories < 500 || calories > 10000 || proteinG < 10 || proteinG > 500) {
          skipped.push('Could not understand the goals');
          break;
        }
        push({ type: 'set_goals', calories: Math.round(calories), proteinG: Math.round(proteinG) });
        break;
      }
      case 'archive_routine': {
        const item = need(ctx.routines, e.ref, 'routine');
        if (item) push({ type: 'archive_routine', id: item.id, title: item.title });
        break;
      }
      case 'delete_task': {
        const item = need(ctx.tasks, e.ref, 'task');
        if (item) push({ type: 'delete_task', id: item.id, title: item.title });
        break;
      }
      case 'delete_meal': {
        const item = need(ctx.meals, e.ref, 'meal');
        if (item) push({ type: 'delete_meal', id: item.id, title: item.title });
        break;
      }
      default:
        skipped.push('Skipped something I do not support');
    }
  }
  return { reply, actions, skipped };
}

/** Deletes, archives and goal changes wait for a tap (or a spoken "yes"); everything else applies with Undo. */
export const isRisky = (a: Action): boolean =>
  a.type === 'set_goals' || a.type === 'archive_routine' || a.type === 'delete_task' || a.type === 'delete_meal';

const relative = (date: string, today: string): string =>
  date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : date === addDays(today, -1) ? 'yesterday' : date;

/** Short human description shown on action chips and confirm cards. */
export function describeAction(a: Action, today: string): string {
  switch (a.type) {
    case 'add_routine':
      return `New routine: ${a.title} (${a.days ? a.days.map((d) => DAY_NAMES[d]).join(' · ') : 'every day'})`;
    case 'add_task':
      return `New task: ${a.title} (${relative(a.date, today)})`;
    case 'log_meal':
      return `Log ${slotLabel(a.slot).toLowerCase()}${a.date === today ? '' : ` ${relative(a.date, today)}`}: ${a.description}`;
    case 'set_routine_done':
      return `${a.done ? 'Check off' : 'Uncheck'} ${a.title}${a.date === today ? '' : ` (${relative(a.date, today)})`}`;
    case 'set_task_done':
      return `${a.done ? 'Complete' : 'Reopen'} task: ${a.title}`;
    case 'reschedule_task':
      return `Move task "${a.title}" to ${relative(a.date, today)}`;
    case 'log_weight':
      return `Log weight ${a.kg} kg${a.date === today ? '' : ` (${relative(a.date, today)})`}`;
    case 'set_goals':
      return `Set meal goals: ${a.calories} kcal, ${a.proteinG} g protein`;
    case 'archive_routine':
      return `Archive routine: ${a.title}`;
    case 'delete_task':
      return `Delete task: ${a.title}`;
    case 'delete_meal':
      return `Delete meal: ${a.title}`;
  }
}

/** A short spoken "yes" / "no" to a pending confirmation. Longer sentences go to the model instead. */
export function confirmIntent(text: string): 'yes' | 'no' | null {
  const w = words(text);
  if (w.length === 0 || w.length > 4) return null;
  const t = w.join(' ');
  if (/^(yes|yeah|yep|yup|sure|ok|okay|confirm|do it|go ahead|please do|proceed|correct)\b/.test(t)) return 'yes';
  if (/^(no|nope|cancel|stop|don t|do not|never mind|nevermind|abort)\b/.test(t)) return 'no';
  return null;
}

/** Keeps only the last few exchanges so follow-ups ("make it 7 pm") work without growing the prompt. */
export const HISTORY_TURNS = 3;

export type Turn = { role: 'user' | 'assistant'; text: string };

/**
 * Makes a transcript valid for every provider: starts with a user turn, alternates roles (neighbours of the same
 * role are merged) and ends with an assistant turn, since the new request is appended as a user turn. Keeps the
 * most recent `max` turns.
 */
export function normalizeHistory(turns: Turn[], max: number): Turn[] {
  const merged: Turn[] = [];
  for (const t of turns) {
    const text = t.text.trim();
    if (!text) continue;
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) last.text = `${last.text}\n${text}`;
    else merged.push({ role: t.role, text });
  }
  while (merged.length && merged[merged.length - 1].role === 'user') merged.pop();
  let out = merged.slice(-max);
  while (out.length && out[0].role === 'assistant') out = out.slice(1);
  return out;
}
