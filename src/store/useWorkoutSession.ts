import { create } from 'zustand';
import type { WorkoutRepository } from '@/data/repository';
import { sqliteWorkoutRepo } from '@/data/sqliteWorkoutLogRepository';
import { UserError } from '@/domain/errors';
import { newId } from '@/domain/id';
import * as S from '@/domain/session';
import type { Workout, WorkoutSet, WorkoutExercise, WorkoutTemplate } from '@/domain/workout';
import { useRestTimer } from '@/store/useRestTimer';
import { useWorkoutHistory } from '@/store/useWorkoutHistory';

const repo: WorkoutRepository = sqliteWorkoutRepo;
const SAVE_DELAY_MS = 350;

type Mode = 'live' | 'edit';
type SetPatch = Partial<Omit<WorkoutSet, 'id' | 'index'>>;

type State = {
  /** The workout on screen: the one being logged right now (live) or a finished one being edited (edit). */
  workout: Workout | null;
  mode: Mode | null;
  /** JSON of the workout when it was opened (edit mode), to tell whether anything changed. */
  baseline: string | null;
  /** Past performances per exercise id (finished workouts), for "previous" values and live PR badges. */
  histories: Record<string, Workout[]>;

  /** Resumes a workout that was in progress when the app was closed or killed. */
  load: () => Promise<void>;
  startFromTemplate: (template: WorkoutTemplate | null) => Promise<void>;
  beginEdit: (id: string) => Promise<void>;
  /** Writes the in-progress workout to SQLite now (called on background and before leaving). */
  flush: () => Promise<void>;
  /** Live: finalize and save, return the saved workout. Edit: save changes. */
  finish: (opts?: { countFilled?: boolean }) => Promise<Workout>;
  /** Live: delete the workout. Edit: just close without saving. */
  discard: () => Promise<void>;

  setTitle: (title: string) => void;
  setNotes: (notes: string) => void;
  addExercises: (ids: string[]) => Promise<void>;
  removeExercise: (exId: string) => void;
  replaceExercise: (exId: string, newExerciseId: string) => Promise<void>;
  reorderExercises: (ids: string[]) => void;
  linkNext: (exId: string) => void;
  unlink: (exId: string) => void;
  patchExercise: (exId: string, patch: Partial<Pick<WorkoutExercise, 'notes' | 'notesPinned' | 'restSeconds'>>) => void;
  patchSet: (exId: string, setId: string, patch: SetPatch) => void;
  /** Ticks/un-ticks a set; ticking starts the exercise's rest timer (live mode). Returns whether the set is now done. */
  toggleSet: (exId: string, setId: string) => boolean;
  addSet: (exId: string) => void;
  removeSet: (exId: string, setId: string) => void;
  cycleSetType: (exId: string, setId: string) => void;
  insertWarmups: (exId: string, warmups: { weightKg: number; reps: number }[]) => void;
};

let timer: ReturnType<typeof setTimeout> | null = null;
let saving: Promise<void> = Promise.resolve();
let finishing = false;

export const useWorkoutSession = create<State>((set, get) => {
  /** Applies a pure edit and (live mode) schedules the write. `now` is the moment of an immediate-write edit. */
  const apply = (fn: (w: Workout) => Workout, immediate = false) => {
    const w = get().workout;
    if (!w) return;
    set({ workout: fn(w) });
    if (get().mode !== 'live') return;
    if (immediate) void get().flush();
    else schedule();
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void get().flush();
    }, SAVE_DELAY_MS);
  };

  const loadHistories = async (ids: string[]) => {
    const missing = [...new Set(ids)].filter((id) => !(id in get().histories));
    if (missing.length === 0) return;
    const all = await repo.listForExercises(missing);
    const next = { ...get().histories };
    for (const id of missing) next[id] = all.filter((w) => w.exercises.some((e) => e.exerciseId === id));
    set({ histories: next });
  };
  const historyFor = (ids: string[]) => {
    const h = get().histories;
    const seen = new Set<string>();
    const out: Workout[] = [];
    for (const id of ids) for (const w of h[id] ?? []) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      out.push(w);
    }
    return out;
  };

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    useRestTimer.getState().stop();
    set({ workout: null, mode: null, baseline: null, histories: {} });
  };

  return {
    workout: null,
    mode: null,
    baseline: null,
    histories: {},

    async load() {
      const active = await repo.getActive();
      if (!active) {
        if (get().mode === 'live') clear(); // e.g. a cloud restore replaced the data
        return;
      }
      await loadHistories(active.exercises.map((e) => e.exerciseId));
      set({ workout: active, mode: 'live' });
    },

    async startFromTemplate(template) {
      if (get().workout) {
        if (get().mode === 'live') throw new UserError('Finish or discard the workout in progress first.');
        clear(); // a finished workout left open for editing (never saved) must not block starting a new one
      }
      await loadHistories(template?.exercises.map((e) => e.exerciseId) ?? []);
      const ids = template?.exercises.map((e) => e.exerciseId) ?? [];
      const w = S.startWorkout({ id: newId(), now: new Date(), template, history: historyFor(ids), makeId: newId });
      await repo.save(w); // persisted from the first moment so a kill can resume it
      set({ workout: w, mode: 'live' });
    },

    async beginEdit(id) {
      if (get().workout && get().mode === 'live') throw new UserError('Finish or discard the workout in progress first.');
      const w = await repo.get(id);
      if (!w) throw new UserError('That workout no longer exists.');
      await loadHistories(w.exercises.map((e) => e.exerciseId));
      set({ workout: w, mode: 'edit', baseline: JSON.stringify(w) });
    },

    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const { workout, mode } = get();
      if (!workout || mode !== 'live' || finishing) return; // finish() writes the final version itself
      saving = saving.then(() => repo.save(workout)).catch((e) => console.warn('Saving workout failed', e));
      await saving;
    },

    async finish(opts) {
      const { workout, mode } = get();
      if (!workout || !mode) throw new UserError('There is no workout to finish.');
      const now = new Date();
      const filled = opts?.countFilled ? S.completeFilledSets(workout, now) : workout;
      const done = S.finalizeWorkout(filled, now);
      const saved: Workout = mode === 'edit' ? { ...done, endedAt: workout.endedAt } : done;
      // A debounced autosave of the old (unfinished) version must not land after the final save and resurrect it.
      finishing = true;
      if (timer) clearTimeout(timer);
      timer = null;
      try {
        await saving; // let any pending background write land first
        await repo.save(saved);
        clear();
      } finally {
        finishing = false;
      }
      await useWorkoutHistory.getState().load();
      return saved;
    },

    async discard() {
      const { workout, mode } = get();
      if (workout && mode === 'live') {
        finishing = true; // no autosave may re-create the workout while it is being deleted
        if (timer) clearTimeout(timer);
        timer = null;
        try {
          await saving;
          await repo.remove(workout.id);
        } finally {
          finishing = false;
        }
      }
      clear();
    },

    setTitle: (title) => apply((w) => ({ ...w, title })),
    setNotes: (notes) => apply((w) => ({ ...w, notes })),
    async addExercises(ids) {
      await loadHistories(ids);
      const exIds = get().workout?.exercises.map((e) => e.exerciseId) ?? [];
      apply((w) => S.addExercises(w, ids, historyFor([...ids, ...exIds]), newId), true);
    },
    removeExercise: (exId) => apply((w) => S.removeExercise(w, exId), true),
    async replaceExercise(exId, newExerciseId) {
      await loadHistories([newExerciseId]);
      apply((w) => S.replaceExercise(w, exId, newExerciseId, historyFor([newExerciseId]), newId), true);
    },
    reorderExercises: (ids) => apply((w) => S.reorderExercises(w, ids), true),
    linkNext: (exId) => apply((w) => S.linkNext(w, exId, newId), true),
    unlink: (exId) => apply((w) => S.unlink(w, exId), true),
    patchExercise: (exId, patch) => apply((w) => S.patchExercise(w, exId, patch)),
    patchSet: (exId, setId, patch) => apply((w) => S.patchSet(w, exId, setId, patch)),
    toggleSet(exId, setId) {
      const before = get().workout?.exercises.find((e) => e.id === exId)?.sets.find((s) => s.id === setId);
      if (!before) return false;
      apply((w) => S.toggleSet(w, exId, setId, new Date()), true);
      const nowDone = !before.isCompleted;
      if (nowDone && get().mode === 'live') {
        const rest = get().workout?.exercises.find((e) => e.id === exId)?.restSeconds ?? 0;
        useRestTimer.getState().start(rest);
      }
      return nowDone;
    },
    addSet: (exId) => apply((w) => S.addSet(w, exId, newId), true),
    removeSet: (exId, setId) => apply((w) => S.removeSet(w, exId, setId), true),
    cycleSetType: (exId, setId) => apply((w) => S.cycleSetType(w, exId, setId)),
    insertWarmups: (exId, warmups) => apply((w) => S.insertWarmups(w, exId, warmups, newId), true),
  };
});
