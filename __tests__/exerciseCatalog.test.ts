import { SEED_EXERCISES, allExercises, findByTitle, searchExercises } from '@/domain/exerciseCatalog';
import { isEquipment, isExerciseType, isMuscle, type ExerciseDef } from '@/domain/workout';

describe('seed catalog', () => {
  it('is a valid, unique, original-sized list', () => {
    expect(SEED_EXERCISES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(SEED_EXERCISES.map((e) => e.id)).size).toBe(SEED_EXERCISES.length);
    expect(new Set(SEED_EXERCISES.map((e) => e.title.toLowerCase())).size).toBe(SEED_EXERCISES.length);
    for (const e of SEED_EXERCISES) {
      expect(e.id.startsWith('seed:')).toBe(true);
      expect(isExerciseType(e.type) && isMuscle(e.primaryMuscle) && isEquipment(e.equipment)).toBe(true);
      expect(e.secondaryMuscles.every(isMuscle)).toBe(true);
      expect(e.isCustom).toBe(false);
    }
  });
  it('covers every implemented exercise type', () => {
    const types = new Set(SEED_EXERCISES.map((e) => e.type));
    for (const t of ['weight_reps', 'bodyweight_reps', 'bodyweight_assisted_reps', 'weight_duration', 'duration', 'reps_only', 'distance_duration']) {
      expect(types.has(t as never)).toBe(true);
    }
  });
});

describe('searchExercises', () => {
  const custom: ExerciseDef = { id: 'c1', title: 'Zercher Squat', type: 'weight_reps', primaryMuscle: 'quads', secondaryMuscles: [], equipment: 'barbell', isCustom: true };
  const all = allExercises([custom]);

  it('finds by word prefix, any order, case-insensitive', () => {
    expect(searchExercises(all, { query: 'bench' }).map((e) => e.title)).toContain('Barbell Bench Press');
    expect(searchExercises(all, { query: 'PRESS bar' }).map((e) => e.title)).toContain('Barbell Bench Press');
    expect(searchExercises(all, { query: 'farmers' }).map((e) => e.title)).toEqual(['Farmer’s Carry']);
  });
  it('ranks titles starting with the query first', () => {
    const pressFirst: ExerciseDef = { ...custom, id: 'c2', title: 'Press Machine Z' };
    const r = searchExercises(allExercises([pressFirst]), { query: 'press' }).map((e) => e.title);
    expect(r[0]).toBe('Press Machine Z');
    expect(r).toContain('Leg Press');
  });
  it('filters by muscle (primary or secondary) and equipment, and includes customs', () => {
    expect(searchExercises(all, { muscle: 'triceps' }).map((e) => e.title)).toContain('Triceps Pushdown');
    expect(searchExercises(all, { muscle: 'triceps' }).map((e) => e.title)).toContain('Push-Up'); // secondary
    expect(searchExercises(all, { equipment: 'barbell', query: 'zercher' })).toEqual([custom]);
    expect(searchExercises(all, { query: 'nothing-like-this' })).toEqual([]);
  });
  it('matches titles case-insensitively for imports', () => {
    expect(findByTitle(all, '  barbell bench press ')?.id).toBe('seed:barbell-bench-press');
    expect(findByTitle(all, 'Nope')).toBeUndefined();
  });
});
