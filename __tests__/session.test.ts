import {
  addExercises,
  addSet,
  completeFilledSets,
  completedSets,
  cycleSetType,
  defaultWorkoutTitle,
  finalizeWorkout,
  incompleteSetCount,
  insertWarmups,
  lastPerformance,
  patchSet,
  previousSet,
  removeExercise,
  removeSet,
  replaceExercise,
  reorderExercises,
  startWorkout,
  toggleSet,
  workingWeightKg,
} from '@/domain/session';
import type { TemplateExercise, WorkoutTemplate } from '@/domain/workout';
import { ex, set, workout } from '../testutils/workoutFixtures';

let n = 0;
const mk = () => `id${++n}`;
const NOW = new Date('2026-11-08T10:00:00.000Z');

const tex = (exerciseId: string, sets: { w?: number; r?: number; type?: 'normal' | 'warmup' }[], extra: Partial<TemplateExercise> = {}): TemplateExercise => ({
  id: mk(),
  exerciseId,
  position: 0,
  supersetId: null,
  restSeconds: 120,
  notes: '',
  notesPinned: false,
  sets: sets.map((s, i) => ({
    id: mk(),
    index: i,
    setType: s.type ?? 'normal',
    repMin: 8,
    repMax: 12,
    weightKg: s.w ?? null,
    reps: s.r ?? null,
    durationSeconds: null,
    distanceMeters: null,
  })),
  ...extra,
});
const tpl = (id: string, exercises: TemplateExercise[]): WorkoutTemplate => ({ id, title: 'Push', notes: '', folderId: null, position: 0, exercises });

describe('lastPerformance', () => {
  const a = workout('2026-10-01', [ex('bench', [set(80, 8), set(80, 7)])], { templateId: 'T1' });
  const b = workout('2026-10-15', [ex('bench', [set(85, 5)])], { templateId: null });
  const c = workout('2026-10-20', [ex('bench', [set(90, 3, { isCompleted: false })])]);

  it('prefers the same template, otherwise the newest', () => {
    expect(lastPerformance([a, b], 'bench', 'T1')?.sets[0].weightKg).toBe(80);
    expect(lastPerformance([a, b], 'bench', null)?.sets[0].weightKg).toBe(85);
    expect(lastPerformance([a, b], 'bench', 'OTHER')?.sets[0].weightKg).toBe(85);
  });
  it('ignores unfinished workouts and workouts with no completed set; null if never done', () => {
    expect(lastPerformance([c], 'bench', null)).toBeNull();
    expect(lastPerformance([{ ...b, endedAt: null }], 'bench', null)).toBeNull();
    expect(lastPerformance([a], 'squat', null)).toBeNull();
  });
  it('keeps only completed sets, in order', () => {
    const w = workout('2026-10-01', [ex('bench', [set(80, 8), set(80, 7, { isCompleted: false }), set(70, 6)])]);
    expect(lastPerformance([w], 'bench', null)?.sets.map((s) => s.weightKg)).toEqual([80, 70]);
    expect(previousSet(lastPerformance([w], 'bench', null), 1)?.weightKg).toBe(70);
    expect(previousSet(null, 0)).toBeNull();
  });
});

describe('startWorkout', () => {
  const history = [workout('2026-10-01', [ex('bench', [set(80, 8), set(82.5, 6)], { notes: 'elbows in', notesPinned: true })], { templateId: 'T1' })];

  it('builds an empty workout with a day-based title', () => {
    const w = startWorkout({ id: 'w1', now: NOW, template: null, history: [], makeId: mk });
    expect(w).toMatchObject({ id: 'w1', templateId: null, endedAt: null, exercises: [] });
    expect(w.title).toBe(defaultWorkoutTitle(NOW));
    expect(w.startedAt).toBe(NOW.toISOString());
  });

  it('creates unticked sets from the template, prefilled from targets, then last time', () => {
    const t = tpl('T1', [tex('bench', [{ w: 60, r: 10 }, {}, {}]), tex('row', [{ r: 12 }])]);
    const w = startWorkout({ id: 'w1', now: NOW, template: t, history, makeId: mk });
    expect(w.templateId).toBe('T1');
    expect(w.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'row']);
    const bench = w.exercises[0];
    expect(bench.sets.every((s) => !s.isCompleted)).toBe(true);
    expect(bench.sets.map((s) => [s.weightKg, s.reps])).toEqual([[60, 10], [82.5, 6], [82.5, 6]]); // target, last time 2nd set, last time's last set
    expect(bench.restSeconds).toBe(120); // rest comes from the template only
    expect(w.exercises[1].sets[0]).toMatchObject({ weightKg: null, reps: 12 });
  });

  it('has no rest timer unless the template opts in', () => {
    const t = tpl('T1', [tex('bench', [{}], { restSeconds: null }), tex('row', [{}], { restSeconds: 60 })]);
    const w = startWorkout({ id: 'w1', now: NOW, template: t, history, makeId: mk });
    expect(w.exercises.map((e) => e.restSeconds)).toEqual([null, 60]);
    // exercises added on the fly never get a timer either, even if they were logged with one before
    const added = addExercises(w, ['bench'], history, mk);
    expect(added.exercises[2].restSeconds).toBeNull();
  });

  it('carries pinned notes forward from last time', () => {
    const t = tpl('T1', [tex('bench', [{}])]);
    const w = startWorkout({ id: 'w1', now: NOW, template: t, history, makeId: mk });
    expect(w.exercises[0]).toMatchObject({ notes: 'elbows in', notesPinned: true });
    const unpinned = [workout('2026-10-01', [ex('bench', [set(80, 8)], { notes: 'only once', notesPinned: false })])];
    expect(startWorkout({ id: 'w2', now: NOW, template: t, history: unpinned, makeId: mk }).exercises[0].notes).toBe('');
  });

  it('keeps template supersets and warm-up set types', () => {
    const t = tpl('T1', [tex('a', [{ type: 'warmup', w: 20, r: 10 }, { w: 60, r: 8 }], { supersetId: 'S' }), tex('b', [{}], { supersetId: 'S' })]);
    const w = startWorkout({ id: 'w1', now: NOW, template: t, history: [], makeId: mk });
    expect(w.exercises.map((e) => e.supersetId)).toEqual(['S', 'S']);
    expect(w.exercises[0].sets.map((s) => s.setType)).toEqual(['warmup', 'normal']);
  });
});

describe('editing a workout in progress', () => {
  const base = () => startWorkout({ id: 'w1', now: NOW, template: tpl('T', [tex('bench', [{ w: 60, r: 10 }, { w: 60, r: 10 }]), tex('row', [{ w: 40, r: 10 }])]), history: [], makeId: mk });

  it('ticks and un-ticks a set, stamping completedAt', () => {
    const w = base();
    const [e, s] = [w.exercises[0], w.exercises[0].sets[0]];
    const ticked = toggleSet(w, e.id, s.id, NOW);
    expect(ticked.exercises[0].sets[0]).toMatchObject({ isCompleted: true, completedAt: NOW.toISOString() });
    expect(ticked.exercises[0].sets[1].isCompleted).toBe(false);
    expect(ticked.exercises[1]).toBe(w.exercises[1]); // untouched exercises are the same object (cheap re-render)
    expect(toggleSet(ticked, e.id, s.id, NOW).exercises[0].sets[0]).toMatchObject({ isCompleted: false, completedAt: null });
    expect(completedSets(ticked)).toBe(1);
    expect(incompleteSetCount(ticked)).toBe(2);
  });

  it('adds a set copying the last numbers, removes sets and renumbers', () => {
    let w = base();
    const e = w.exercises[0];
    w = patchSet(w, e.id, e.sets[1].id, { weightKg: 65, reps: 8 });
    w = addSet(w, e.id, mk);
    expect(w.exercises[0].sets).toHaveLength(3);
    expect(w.exercises[0].sets[2]).toMatchObject({ index: 2, weightKg: 65, reps: 8, isCompleted: false, setType: 'normal' });
    w = removeSet(w, e.id, w.exercises[0].sets[0].id);
    expect(w.exercises[0].sets.map((s) => s.index)).toEqual([0, 1]);
  });

  it('cycles set types normal → warm-up → drop → failure → normal', () => {
    let w = base();
    const { id: exId } = w.exercises[0];
    const setId = w.exercises[0].sets[0].id;
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      w = cycleSetType(w, exId, setId);
      seen.push(w.exercises[0].sets[0].setType);
    }
    expect(seen).toEqual(['warmup', 'dropset', 'failure', 'normal']);
  });

  it('adds, removes, replaces and reorders exercises', () => {
    let w = base();
    w = addExercises(w, ['squat', 'curl'], [], mk);
    expect(w.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'row', 'squat', 'curl']);
    expect(w.exercises.map((e) => e.position)).toEqual([0, 1, 2, 3]);
    w = reorderExercises(w, [w.exercises[3].id, w.exercises[0].id, w.exercises[1].id, w.exercises[2].id]);
    expect(w.exercises.map((e) => e.exerciseId)).toEqual(['curl', 'bench', 'row', 'squat']);
    const rowId = w.exercises[2].id;
    w = replaceExercise(w, rowId, 'cable-row', [], mk);
    expect(w.exercises[2]).toMatchObject({ id: rowId, exerciseId: 'cable-row' });
    expect(w.exercises[2].sets.every((s) => !s.isCompleted)).toBe(true);
    w = removeExercise(w, rowId);
    expect(w.exercises.map((e) => e.exerciseId)).toEqual(['curl', 'bench', 'squat']);
  });

  it('a newly added exercise mirrors the last time (set count and numbers)', () => {
    const hist = [workout('2026-10-01', [ex('squat', [set(100, 5), set(100, 5), set(100, 4)])])];
    const w = addExercises(base(), ['squat'], hist, mk);
    const squat = w.exercises[w.exercises.length - 1];
    expect(squat.sets.map((s) => [s.weightKg, s.reps, s.isCompleted])).toEqual([[100, 5, false], [100, 5, false], [100, 4, false]]);
  });

  it('inserts warm-ups on top and finds the working weight', () => {
    let w = base();
    const e = w.exercises[0];
    expect(workingWeightKg(e)).toBe(60);
    w = insertWarmups(w, e.id, [{ weightKg: 24, reps: 8 }, { weightKg: 36, reps: 5 }], mk);
    expect(w.exercises[0].sets.map((s) => [s.setType, s.weightKg, s.index])).toEqual([
      ['warmup', 24, 0], ['warmup', 36, 1], ['normal', 60, 2], ['normal', 60, 3],
    ]);
    expect(workingWeightKg(w.exercises[0])).toBe(60); // warm-ups never count as the working weight
    expect(insertWarmups(w, e.id, [], mk)).toBe(w);
  });
});

describe('finishing', () => {
  it('drops unticked sets and empty exercises, renumbers, sets the end time', () => {
    let w = startWorkout({ id: 'w1', now: NOW, template: tpl('T', [tex('bench', [{ w: 60, r: 10 }, { w: 60, r: 10 }, { w: 60, r: 10 }]), tex('row', [{ w: 40, r: 10 }])]), history: [], makeId: mk });
    w = toggleSet(w, w.exercises[0].id, w.exercises[0].sets[0].id, NOW);
    w = toggleSet(w, w.exercises[0].id, w.exercises[0].sets[2].id, NOW);
    const end = new Date('2026-11-08T11:00:00.000Z');
    const done = finalizeWorkout(w, end);
    expect(done.endedAt).toBe(end.toISOString());
    expect(done.exercises).toHaveLength(1);
    expect(done.exercises[0].sets.map((s) => s.index)).toEqual([0, 1]);
    expect(done.exercises[0].sets.every((s) => s.isCompleted)).toBe(true);
  });

  it('can count sets that have numbers typed in but were never ticked', () => {
    let w = startWorkout({ id: 'w1', now: NOW, template: tpl('T', [tex('bench', [{ w: 60, r: 10 }, {}])]), history: [], makeId: mk });
    w = completeFilledSets(w, NOW);
    expect(w.exercises[0].sets.map((s) => s.isCompleted)).toEqual([true, false]);
  });

  it('keeps supersets valid when an exercise disappears', () => {
    let w = startWorkout({ id: 'w1', now: NOW, template: tpl('T', [tex('a', [{ w: 1, r: 1 }], { supersetId: 'S' }), tex('b', [{ w: 1, r: 1 }], { supersetId: 'S' })]), history: [], makeId: mk });
    w = toggleSet(w, w.exercises[0].id, w.exercises[0].sets[0].id, NOW); // only "a" is done
    expect(finalizeWorkout(w, NOW).exercises[0].supersetId).toBeNull();
  });
});
