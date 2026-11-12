import { diffTemplate, duplicateTemplate, newTemplateExercise, reorderSubset, shouldOfferTemplateUpdate, templateFromWorkout } from '@/domain/template';
import type { TemplateExercise, WorkoutTemplate } from '@/domain/workout';
import { ex, set, workout } from '../testutils/workoutFixtures';

let n = 0;
const nid = () => `t${++n}`;
const tex = (exerciseId: string, sets: { w?: number | null; r?: number | null; type?: 'normal' | 'warmup' }[], extra: Partial<TemplateExercise> = {}): TemplateExercise => ({
  id: nid(),
  exerciseId,
  position: 0,
  supersetId: null,
  restSeconds: 90,
  notes: '',
  notesPinned: false,
  sets: sets.map((s, i) => ({
    id: nid(),
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
const tpl = (exercises: TemplateExercise[]): WorkoutTemplate => ({ id: 'T', title: 'Push', notes: '', folderId: null, position: 0, exercises });

describe('newTemplateExercise', () => {
  it('starts without a rest timer (opt-in)', () => {
    expect(newTemplateExercise('e1', 's1', 'bench', 0).restSeconds).toBeNull();
  });
});

describe('diffTemplate', () => {
  const template = tpl([tex('bench', [{ w: 80, r: 8 }, { w: 80, r: 8 }]), tex('ohp', [{ w: 40, r: 10 }])]);

  it('no change', () => {
    const w = workout('2026-01-01', [ex('bench', [set(80, 8), set(80, 8)]), ex('ohp', [set(40, 10)])]);
    const d = diffTemplate(template, w);
    expect(d).toMatchObject({ major: false, minor: false, addedExerciseIds: [], removedExerciseIds: [] });
    expect(shouldOfferTemplateUpdate(d)).toBe(false);
  });

  it('weight/rep/set-count changes are minor', () => {
    const w = workout('2026-01-01', [ex('bench', [set(85, 8), set(85, 6), set(85, 5)]), ex('ohp', [set(40, 10)])]);
    const d = diffTemplate(template, w);
    expect(d).toMatchObject({ major: false, minor: true, changedExerciseIds: ['bench'] });
    expect(shouldOfferTemplateUpdate(d)).toBe(false);
    expect(shouldOfferTemplateUpdate(d, true)).toBe(true);
  });

  it('empty template weights and reps are "no target", so logging numbers is not a change (imported templates)', () => {
    const blank = tpl([tex('bench', [{}, {}]), tex('ohp', [{ type: 'warmup' }])]);
    const same = diffTemplate(blank, workout('2026-01-01', [ex('bench', [set(80, 8), set(82.5, 6)]), ex('ohp', [set(20, 10, { type: 'warmup' })])]));
    expect(same).toMatchObject({ major: false, minor: false });
    // still a change when the set count or type differs, or a filled target is missed
    expect(diffTemplate(blank, workout('2026-01-01', [ex('bench', [set(80, 8)]), ex('ohp', [set(20, 10, { type: 'warmup' })])])).minor).toBe(true);
    expect(diffTemplate(blank, workout('2026-01-01', [ex('bench', [set(80, 8), set(80, 8)]), ex('ohp', [set(20, 10)])])).minor).toBe(true);
    expect(diffTemplate(tpl([tex('bench', [{ w: 80 }])]), workout('2026-01-01', [ex('bench', [set(85, 8)])])).minor).toBe(true);
  });

  it('adding or removing an exercise is major', () => {
    const added = diffTemplate(template, workout('2026-01-01', [ex('bench', [set(80, 8), set(80, 8)]), ex('ohp', [set(40, 10)]), ex('dips', [set(0, 10)])]));
    expect(added).toMatchObject({ major: true, addedExerciseIds: ['dips'] });
    const removed = diffTemplate(template, workout('2026-01-01', [ex('bench', [set(80, 8), set(80, 8)])]));
    expect(removed).toMatchObject({ major: true, removedExerciseIds: ['ohp'] });
    expect(shouldOfferTemplateUpdate(removed)).toBe(true);
  });

  it('only completed sets count: an exercise with none is removed, unfinished extra sets are ignored', () => {
    const w = workout('2026-01-01', [ex('bench', [set(80, 8), set(80, 8), set(80, 8, { isCompleted: false })]), ex('ohp', [set(40, 10, { isCompleted: false })])]);
    expect(diffTemplate(template, w)).toMatchObject({ major: true, removedExerciseIds: ['ohp'], changedExerciseIds: [] });
  });

  it('reordering is minor', () => {
    const w = workout('2026-01-01', [ex('ohp', [set(40, 10)]), ex('bench', [set(80, 8), set(80, 8)])]);
    expect(diffTemplate(template, w)).toMatchObject({ major: false, minor: true });
  });

  it('matches a repeated exercise occurrence by occurrence', () => {
    const t = tpl([tex('curl', [{ w: 10, r: 10 }]), tex('curl', [{ w: 10, r: 10 }])]);
    expect(diffTemplate(t, workout('2026-01-01', [ex('curl', [set(10, 10)]), ex('curl', [set(10, 10)])]))).toMatchObject({ major: false, minor: false });
    expect(diffTemplate(t, workout('2026-01-01', [ex('curl', [set(10, 10)])]))).toMatchObject({ major: true, removedExerciseIds: ['curl'] });
  });
});

describe('templateFromWorkout', () => {
  it('rebuilds from completed sets, keeping rep ranges and ids where positions match', () => {
    const t = tpl([tex('bench', [{ w: 80, r: 8 }, { w: 80, r: 8 }])]);
    const w = workout('2026-01-01', [ex('bench', [set(85, 8), set(85, 7), set(85, 6, { isCompleted: false })]), ex('dips', [set(0, 10)])]);
    const out = templateFromWorkout(t, w, nid);
    expect(out.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'dips']);
    expect(out.exercises[0].id).toBe(t.exercises[0].id);
    expect(out.exercises[0].sets).toHaveLength(2);
    expect(out.exercises[0].sets.map((s) => [s.weightKg, s.reps, s.repMin, s.repMax])).toEqual([[85, 8, 8, 12], [85, 7, 8, 12]]);
    expect(out.exercises[1].sets[0]).toMatchObject({ repMin: null, repMax: null });
    expect(out.exercises.map((e) => e.position)).toEqual([0, 1]);
  });
});

describe('duplicateTemplate', () => {
  it('regenerates every id and keeps superset links consistent', () => {
    const t = tpl([tex('a', [{ w: 1, r: 1 }], { supersetId: 'S' }), tex('b', [{ w: 1, r: 1 }], { supersetId: 'S' }), tex('c', [{ w: 1, r: 1 }])]);
    const d = duplicateTemplate(t, nid, 5);
    expect(d.title).toBe('Push copy');
    expect(d.position).toBe(5);
    expect(d.id).not.toBe(t.id);
    const oldIds = new Set([t.exercises[0].id, t.exercises[0].sets[0].id, t.exercises[1].id, t.exercises[2].id]);
    for (const e of d.exercises) {
      expect(oldIds.has(e.id)).toBe(false);
      expect(oldIds.has(e.sets[0].id)).toBe(false);
    }
    expect(d.exercises[0].supersetId).toBe(d.exercises[1].supersetId);
    expect(d.exercises[0].supersetId).not.toBe('S');
    expect(d.exercises[2].supersetId).toBeNull();
  });
});

describe('reorderSubset', () => {
  it('moves a subset into its own slots and leaves the rest', () => {
    const all = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
    expect(reorderSubset(all, ['e', 'a', 'c']).map((x) => x.id)).toEqual(['e', 'b', 'a', 'd', 'c']);
    expect(reorderSubset(all, ['zzz']).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
