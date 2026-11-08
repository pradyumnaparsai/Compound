// Every way a request can end must leave something visible on screen and never leave Atomic stuck "thinking".
import type { Action } from '../src/domain/assistant';

jest.mock('@/services/assistant', () => ({ askAssistant: jest.fn() }));
jest.mock('@/services/assistantActions', () => ({ applyAction: jest.fn() }));
jest.mock('@/services/speak', () => ({
  speak: jest.fn(async () => {}),
  stopSpeaking: jest.fn(),
  getMuted: jest.fn(async () => false),
  setMuted: jest.fn(),
}));
jest.mock('@/services/mealAnalyzer', () => ({
  AnalysisCancelled: class AnalysisCancelled extends Error {
    constructor() {
      super('Cancelled');
      this.name = 'AnalysisCancelled';
    }
  },
}));
jest.mock('@/store/useRoutineStore', () => ({ useRoutineStore: { getState: () => ({ routines: [], done: new Set() }) } }));
jest.mock('@/store/useTaskStore', () => ({
  useTaskStore: { getState: () => ({ tasks: [{ id: 'T1', title: 'Buy milk', date: '2026-11-08', createdAt: '', completedAt: null }] }) },
}));
jest.mock('@/store/useMealStore', () => ({ useMealStore: { getState: () => ({ meals: [], goals: null }) } }));
jest.mock('@/store/useWeightStore', () => ({ useWeightStore: { getState: () => ({ entries: [] }) } }));

/* eslint-disable import/first */
import { askAssistant } from '@/services/assistant';
import { applyAction } from '@/services/assistantActions';
import { AnalysisCancelled } from '@/services/mealAnalyzer';
import { cancelPending, closeAssistant, openAssistant, submit, WATCHDOG_MS } from '@/services/assistantRunner';
import { speak } from '@/services/speak';
import { useAssistantStore } from '@/store/useAssistantStore';

const ask = askAssistant as jest.Mock;
const apply = applyAction as jest.Mock;
const spokenMock = speak as jest.Mock;
const state = () => useAssistantStore.getState();
const flush = () => new Promise<void>((r) => setImmediate(() => r()));

const addTask: Action = { type: 'add_task', title: 'Buy milk', date: '2026-11-08' };
const deleteTask: Action = { type: 'delete_task', id: 'T1', title: 'Buy milk' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  useAssistantStore.setState({ muted: false });
  openAssistant();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('submit', () => {
  it('applies safe actions, shows the reply and speaks it', async () => {
    ask.mockResolvedValue({ reply: 'Added it.', actions: [addTask], skipped: [], model: 'x' });
    apply.mockResolvedValue({ text: 'Task added: Buy milk', undo: jest.fn() });
    await submit('add milk');
    await flush();
    expect(state().exchange).toMatchObject({ heard: 'add milk', reply: 'Added it.', chips: [{ text: 'Task added: Buy milk', ok: true }] });
    expect(state().phase).toBe('idle');
    expect(state().undo?.count).toBe(1);
    expect(spokenMock).toHaveBeenCalledWith(expect.stringContaining('Added it.'), expect.any(Function));
  });

  it('answers a plain question without touching anything', async () => {
    ask.mockResolvedValue({ reply: 'You have 800 calories left.', actions: [], skipped: [], model: 'x' });
    await submit('how many calories are left');
    expect(apply).not.toHaveBeenCalled();
    expect(state().exchange?.reply).toBe('You have 800 calories left.');
    expect(state().phase).not.toBe('thinking');
  });

  it('does not speak when muted, but still shows the reply', async () => {
    useAssistantStore.setState({ muted: true });
    ask.mockResolvedValue({ reply: 'Done.', actions: [], skipped: [], model: 'x' });
    await submit('hello');
    await flush();
    expect(spokenMock).not.toHaveBeenCalled();
    expect(state().exchange?.reply).toBe('Done.');
    expect(state().phase).toBe('idle');
  });

  it('holds risky actions for confirmation, then applies them on a spoken yes', async () => {
    ask.mockResolvedValue({ reply: 'Delete it?', actions: [deleteTask], skipped: [], model: 'x' });
    apply.mockResolvedValue({ text: 'Deleted task Buy milk' });
    await submit('delete the milk task');
    expect(apply).not.toHaveBeenCalled();
    expect(state().pending?.labels).toEqual(['Delete task: Buy milk']);
    await submit('yes');
    await flush();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(state().pending).toBeNull();
    expect(state().exchange?.reply).toBe('Done.');
    expect(ask).toHaveBeenCalledTimes(1); // "yes" never goes to the model
  });

  it('drops a pending confirmation on "no"', async () => {
    ask.mockResolvedValue({ reply: 'Delete it?', actions: [deleteTask], skipped: [], model: 'x' });
    await submit('delete the milk task');
    await submit('no');
    expect(apply).not.toHaveBeenCalled();
    expect(state().pending).toBeNull();
    expect(state().exchange?.reply).toMatch(/left it as it was/);
  });

  it('keeps going when one action fails and reports it', async () => {
    ask.mockResolvedValue({ reply: 'On it.', actions: [addTask, addTask], skipped: ['Could not find the task "x"'], model: 'x' });
    apply.mockResolvedValueOnce({ text: 'ok' }).mockRejectedValueOnce(new Error('boom'));
    await submit('do two things');
    expect(state().exchange?.chips.map((c) => c.ok)).toEqual([true, false, false]);
    expect(state().phase).not.toBe('thinking');
  });

  it('shows a visible error when the model call fails', async () => {
    ask.mockRejectedValue(Object.assign(new Error('x HTTP 500'), { status: 500 }));
    await submit('anything');
    await flush();
    expect(state().exchange?.error).toBe(true);
    expect(state().exchange?.reply).toMatch(/trouble/i);
    expect(state().phase).toBe('idle');
  });

  it('goes quietly back to idle when cancelled', async () => {
    ask.mockRejectedValue(new AnalysisCancelled());
    await submit('anything');
    expect(state().phase).toBe('idle');
    expect(state().exchange?.error).toBeFalsy();
  });

  it('ignores a second request while one is running', async () => {
    let release: (v: unknown) => void = () => {};
    ask.mockReturnValue(new Promise((r) => (release = r)));
    const first = submit('one');
    await submit('two');
    expect(ask).toHaveBeenCalledTimes(1);
    release({ reply: 'ok', actions: [], skipped: [], model: 'x' });
    await first;
  });

  it('gives up after the watchdog and says so', async () => {
    jest.useFakeTimers();
    try {
      ask.mockImplementation(
        ({ signal }: { signal: AbortSignal }) =>
          new Promise((_res, rej) => signal.addEventListener('abort', () => rej(new AnalysisCancelled()))),
      );
      const p = submit('slow one');
      await jest.advanceTimersByTimeAsync(WATCHDOG_MS + 10);
      await p;
      expect(state().exchange).toMatchObject({ error: true, reply: 'That took too long. Please try again.' });
      expect(state().phase).not.toBe('thinking');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('panel lifecycle', () => {
  it('cancelPending without a pending question does nothing', () => {
    cancelPending();
    expect(state().exchange).toBeNull();
  });
  it('closing stops a request in flight and clears the thinking state', async () => {
    ask.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_res, rej) => signal.addEventListener('abort', () => rej(new AnalysisCancelled()))),
    );
    const p = submit('hello');
    closeAssistant();
    await p;
    expect(state().open).toBe(false);
    expect(state().phase).toBe('idle');
  });
});
