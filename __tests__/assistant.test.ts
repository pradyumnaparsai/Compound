import {
  buildContext,
  confirmIntent,
  describeAction,
  groqExtras,
  isRisky,
  normalizeHistory,
  parseAssistantReply,
  resolveDate,
  resolveRef,
  type Action,
  type AssistantContext,
  type RefItem,
} from '../src/domain/assistant';
import { mealFromAnalysis, type Meal } from '../src/domain/meal';
import type { Routine, Task } from '../src/domain/types';

const NOW = new Date(2026, 10, 8, 9, 30); // Sun 2026-11-08, 09:30
const TODAY = '2026-11-08';

const routine = (id: string, title: string, over: Partial<Routine> = {}): Routine => ({
  id,
  title,
  recurrence: { type: 'daily' },
  goal: null,
  reminderTime: null,
  createdAt: '2026-01-01',
  archivedAt: null,
  ...over,
});
const task = (id: string, title: string, date: string, completedAt: string | null = null): Task => ({
  id,
  title,
  date,
  createdAt: '2026-11-01T00:00:00.000Z',
  completedAt,
});
const meal = (id: string, date: string, title: string, calories = 400): Meal => ({
  id,
  date,
  slot: 'lunch',
  loggedAt: '2026-11-08T07:00:00.000Z',
  title,
  inputType: 'image_and_note',
  confidence: 8,
  ingredients: [],
  calories,
  proteinG: 20,
  carbsG: 40,
  fatG: 10,
  assumptions: [],
});

const ctx = (): AssistantContext =>
  buildContext({
    routines: [routine('R1', 'Gym workout'), routine('R2', 'Read book'), routine('R3', 'Old habit', { archivedAt: '2026-10-01' })],
    done: new Set(['R2|2026-11-08']),
    tasks: [task('T2', 'Call mom', '2026-11-10'), task('T1', 'Buy milk', '2026-11-08'), task('T3', 'Done thing', '2026-11-08', 'x')],
    meals: [meal('M0', '2026-11-01', 'Ancient meal'), meal('M1', '2026-11-08', 'Paneer wrap')],
    goals: { calories: 2200, proteinG: 120 },
    weights: [{ date: '2026-11-07', kg: 72.4 }],
    now: NOW,
  });

const reply = (actions: unknown[], text = 'ok') => JSON.stringify({ reply: text, actions });

describe('buildContext', () => {
  it('lists active routines, open tasks (by due date) and recent meals with short refs', () => {
    const c = ctx();
    expect(c.routines.map((r) => r.ref)).toEqual(['r1', 'r2']);
    expect(c.tasks.map((t) => [t.ref, t.title])).toEqual([
      ['t1', 'Buy milk'],
      ['t2', 'Call mom'],
    ]);
    expect(c.meals.map((m) => m.title)).toEqual(['Paneer wrap']);
  });
  it('includes the calendar, totals and routine state', () => {
    const t = ctx().text;
    expect(t).toContain('Today: 2026-11-08 (Sunday)');
    expect(t).toContain('tomorrow=2026-11-09');
    expect(t).toContain('Friday=2026-11-13');
    expect(t).toContain('Eaten today: 400 kcal, 20 g protein');
    expect(t).toContain('r2|Read book|Every day|done');
    expect(t).toContain('r1|Gym workout|Every day|todo');
    expect(t).toContain('Last weight: 72.4 kg on 2026-11-07');
  });
  it('strips line breaks and pipes from titles', () => {
    const c = buildContext({ routines: [routine('R1', 'a|b\nc')], done: new Set(), tasks: [], meals: [], goals: null, weights: [], now: NOW });
    expect(c.text).toContain('r1|a b c|');
    expect(c.text).toContain('Meal goals: not set');
  });
});

describe('resolveRef', () => {
  const items: RefItem[] = [
    { ref: 'r1', id: 'R1', title: 'Gym workout' },
    { ref: 'r2', id: 'R2', title: 'Read book' },
    { ref: 'r3', id: 'R3', title: 'Read news' },
  ];
  it('matches a short ref, case-insensitively', () => {
    expect(resolveRef('R2', items)).toEqual({ item: items[1] });
  });
  it('matches an exact title ignoring case and punctuation', () => {
    expect(resolveRef('gym, workout!', items)).toEqual({ item: items[0] });
  });
  it('matches a unique partial title', () => {
    expect(resolveRef('gym', items)).toEqual({ item: items[0] });
  });
  it('reports ambiguity instead of guessing', () => {
    expect(resolveRef('read', items)).toEqual({ reason: 'ambiguous' });
  });
  it('reports missing for unknown or empty refs', () => {
    expect(resolveRef('swim', items)).toEqual({ reason: 'missing' });
    expect(resolveRef('', items)).toEqual({ reason: 'missing' });
    expect(resolveRef(undefined, items)).toEqual({ reason: 'missing' });
  });
});

describe('resolveDate', () => {
  it('uses the fallback when absent', () => {
    expect(resolveDate(undefined, TODAY)).toBe(TODAY);
    expect(resolveDate('', TODAY, null)).toBeNull();
  });
  it('understands keys and relative words', () => {
    expect(resolveDate('2026-12-01', TODAY)).toBe('2026-12-01');
    expect(resolveDate('Tomorrow', TODAY)).toBe('2026-11-09');
    expect(resolveDate('yesterday', TODAY)).toBe('2026-11-07');
  });
  it('rejects impossible or far-off dates', () => {
    expect(resolveDate('2026-02-30', TODAY)).toBeNull();
    expect(resolveDate('next friday', TODAY)).toBeNull();
    expect(resolveDate('2031-01-01', TODAY)).toBeNull();
    expect(resolveDate(5, TODAY)).toBeNull();
  });
});

describe('parseAssistantReply', () => {
  it('parses creates with defaults', () => {
    const p = parseAssistantReply(
      reply([
        { type: 'add_routine', title: ' Meditate ', days: [5, 1, 1] },
        { type: 'add_task', title: 'Pay rent', date: 'tomorrow' },
        { type: 'log_meal', description: '2 rotis and dal' },
      ], 'Done.'),
      ctx(),
      NOW,
    );
    expect(p.reply).toBe('Done.');
    expect(p.skipped).toEqual([]);
    expect(p.actions).toEqual<Action[]>([
      { type: 'add_routine', title: 'Meditate', days: [1, 5] },
      { type: 'add_task', title: 'Pay rent', date: '2026-11-09' },
      { type: 'log_meal', description: '2 rotis and dal', slot: 'breakfast', date: TODAY }, // 09:30 → breakfast
    ]);
  });
  it('treats missing or full-week days as every day, and rejects bad days', () => {
    const p = parseAssistantReply(
      reply([
        { type: 'add_routine', title: 'A' },
        { type: 'add_routine', title: 'B', days: [0, 1, 2, 3, 4, 5, 6] },
        { type: 'add_routine', title: 'C', days: [9] },
      ]),
      ctx(),
      NOW,
    );
    expect(p.actions.map((a) => a.type === 'add_routine' && a.days)).toEqual([null, null]);
    expect(p.skipped).toHaveLength(1);
  });
  it('resolves refs to real ids', () => {
    const p = parseAssistantReply(
      reply([
        { type: 'set_routine_done', ref: 'gym', done: true },
        { type: 'set_task_done', ref: 't1' },
        { type: 'reschedule_task', ref: 'Call mom', date: '2026-11-12' },
        { type: 'delete_meal', ref: 'm1' },
        { type: 'archive_routine', ref: 'r2' },
        { type: 'delete_task', ref: 'milk' },
      ]),
      ctx(),
      NOW,
    );
    expect(p.actions).toEqual<Action[]>([
      { type: 'set_routine_done', id: 'R1', title: 'Gym workout', date: TODAY, done: true },
      { type: 'set_task_done', id: 'T1', title: 'Buy milk', done: true },
      { type: 'reschedule_task', id: 'T2', title: 'Call mom', date: '2026-11-12' },
      { type: 'delete_meal', id: 'M1', title: 'Paneer wrap' },
      { type: 'archive_routine', id: 'R2', title: 'Read book' },
      { type: 'delete_task', id: 'T1', title: 'Buy milk' },
    ]);
  });
  it('skips unknown refs but keeps the valid actions', () => {
    const p = parseAssistantReply(
      reply([{ type: 'delete_task', ref: 'dentist' }, { type: 'add_task', title: 'Run' }]),
      ctx(),
      NOW,
    );
    expect(p.actions).toHaveLength(1);
    expect(p.skipped).toEqual(['Could not find the task "dentist"']);
  });
  it('never targets archived routines or completed tasks', () => {
    const p = parseAssistantReply(
      reply([{ type: 'archive_routine', ref: 'Old habit' }, { type: 'set_task_done', ref: 'Done thing' }]),
      ctx(),
      NOW,
    );
    expect(p.actions).toEqual([]);
    expect(p.skipped).toHaveLength(2);
  });
  it('validates weight', () => {
    const p = parseAssistantReply(
      reply([{ type: 'log_weight', kg: '72,46' }, { type: 'log_weight', kg: 7 }, { type: 'log_weight', kg: 'heavy' }]),
      ctx(),
      NOW,
    );
    expect(p.actions).toEqual([{ type: 'log_weight', kg: 72.5, date: TODAY }]);
    expect(p.skipped).toHaveLength(2);
  });
  it('merges partial goals with the existing ones and enforces ranges', () => {
    const p = parseAssistantReply(
      reply([{ type: 'set_goals', protein_g: 150 }, { type: 'set_goals', calories: 100 }, { type: 'set_goals' }]),
      ctx(),
      NOW,
    );
    expect(p.actions).toEqual([{ type: 'set_goals', calories: 2200, proteinG: 150 }]);
    expect(p.skipped).toHaveLength(2);
  });
  it('refuses partial goals when none are set yet', () => {
    const empty = buildContext({ routines: [], done: new Set(), tasks: [], meals: [], goals: null, weights: [], now: NOW });
    const p = parseAssistantReply(reply([{ type: 'set_goals', protein_g: 150 }]), empty, NOW);
    expect(p.actions).toEqual([]);
  });
  it('drops duplicates, unknown types and non-objects; caps the count', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ type: 'add_task', title: `T${i}` }));
    const p = parseAssistantReply(
      reply([{ type: 'add_task', title: 'X' }, { type: 'add_task', title: 'X' }, { type: 'format_disk' }, 'x', null, ...many]),
      ctx(),
      NOW,
    );
    expect(p.actions.filter((a) => a.type === 'add_task' && a.title === 'X')).toHaveLength(1);
    expect(p.actions.length).toBeLessThanOrEqual(12);
    expect(p.skipped).toContain('Skipped something I do not support');
  });
  it('accepts a chat-only reply, markdown fences and <think> blocks', () => {
    const p = parseAssistantReply('<think>hmm</think>```json\n{"reply":"You have 1800 left.","actions":[]}\n```', ctx(), NOW);
    expect(p).toEqual({ reply: 'You have 1800 left.', actions: [], skipped: [] });
  });
  it('throws on unusable output', () => {
    expect(() => parseAssistantReply('not json', ctx(), NOW)).toThrow(/valid JSON/);
    expect(() => parseAssistantReply('[]', ctx(), NOW)).toThrow(/Unexpected response/);
    expect(() => parseAssistantReply('{"reply":"","actions":[]}', ctx(), NOW)).toThrow(/Unexpected response/);
  });
});

describe('isRisky / describeAction', () => {
  it('flags destructive actions and goal changes only', () => {
    const risky: Action['type'][] = ['set_goals', 'archive_routine', 'delete_task', 'delete_meal'];
    const safe: Action['type'][] = ['add_routine', 'add_task', 'log_meal', 'set_routine_done', 'set_task_done', 'reschedule_task', 'log_weight'];
    const mk = (type: Action['type']) => ({ type }) as Action;
    expect(risky.every((t) => isRisky(mk(t)))).toBe(true);
    expect(safe.some((t) => isRisky(mk(t)))).toBe(false);
  });
  it('describes actions with relative dates', () => {
    expect(describeAction({ type: 'add_task', title: 'Run', date: '2026-11-09' }, TODAY)).toBe('New task: Run (tomorrow)');
    expect(describeAction({ type: 'add_routine', title: 'Gym', days: [1, 3] }, TODAY)).toBe('New routine: Gym (Mon · Wed)');
    expect(describeAction({ type: 'add_routine', title: 'Gym', days: null }, TODAY)).toBe('New routine: Gym (every day)');
    expect(describeAction({ type: 'log_meal', description: 'dal', slot: 'dinner', date: '2026-11-07' }, TODAY)).toBe('Log dinner yesterday: dal');
    expect(describeAction({ type: 'delete_meal', id: 'm', title: 'Wrap' }, TODAY)).toBe('Delete meal: Wrap');
  });
});

describe('confirmIntent', () => {
  it('hears short yes / no answers', () => {
    expect(confirmIntent('Yes.')).toBe('yes');
    expect(confirmIntent('go ahead')).toBe('yes');
    expect(confirmIntent("No, don't")).toBe('no');
    expect(confirmIntent('Cancel that')).toBe('no');
    expect(confirmIntent("don't")).toBe('no');
  });
  it('leaves longer or unrelated sentences to the model', () => {
    expect(confirmIntent('yes and also add milk to my list')).toBeNull();
    expect(confirmIntent('add a task')).toBeNull();
    expect(confirmIntent('')).toBeNull();
  });
});

describe('mealFromAnalysis', () => {
  it('recomputes totals from the ingredients', () => {
    const m = mealFromAnalysis(
      {
        title: 'Dal Rice',
        input_type: 'image_and_note',
        meal_confidence_score: 7,
        ingredients: [
          { name: 'Dal', estimated_quantity: '1 bowl', calories: 150, protein_g: 9, carbs_g: 20, fat_g: 3 },
          { name: 'Rice', estimated_quantity: '1 cup', calories: 200, protein_g: 4, carbs_g: 44, fat_g: 0.5 },
        ],
        assumptions_made: ['1 tsp ghee'],
      },
      'dinner',
      TODAY,
      NOW,
      'id1',
    );
    expect(m).toMatchObject({ id: 'id1', slot: 'dinner', date: TODAY, title: 'Dal Rice', calories: 350, proteinG: 13, carbsG: 64, fatG: 3.5, confidence: 7 });
  });
});

describe('normalizeHistory', () => {
  const u = (text: string) => ({ role: 'user' as const, text });
  const a = (text: string) => ({ role: 'assistant' as const, text });
  it('merges neighbours of the same role', () => {
    expect(normalizeHistory([u('hi'), a('one'), a('two'), u('x'), a('y')], 10)).toEqual([u('hi'), a('one\ntwo'), u('x'), a('y')]);
  });
  it('drops a leading assistant turn, including after trimming to the last turns', () => {
    expect(normalizeHistory([a('a0'), u('u1'), a('a1'), u('u2'), a('a2')], 3)).toEqual([u('u2'), a('a2')]);
    expect(normalizeHistory([a('only')], 6)).toEqual([]);
  });
  it('drops trailing user turns and blanks so the new request can follow', () => {
    expect(normalizeHistory([u('u1'), a('a1'), u('dangling'), u('  ')], 6)).toEqual([u('u1'), a('a1')]);
    expect(normalizeHistory([], 6)).toEqual([]);
  });
});

describe('groqExtras', () => {
  it('turns reasoning off for Qwen 3.8 only', () => {
    expect(groqExtras('qwen/qwen3.8-27b')).toEqual({ reasoning_effort: 'none', reasoning_format: 'hidden' });
    expect(groqExtras('llama-3.3-70b-versatile')).toEqual({});
    expect(groqExtras('qwen/qwen3-32b')).toEqual({});
  });
});
