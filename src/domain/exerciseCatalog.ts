import type { Equipment, ExerciseDef, ExerciseType, Muscle } from './workout';

// Built-in exercises live in code (not SQLite) so that a fresh install still counts as an empty database for
// the cloud-backup check, restores never delete them, and the list can grow over the air. Ids are stable
// ("seed:<slug>"); workouts reference them by id. Original list written for this app.
type Row = [slug: string, title: string, type: ExerciseType, primary: Muscle, equipment: Equipment, secondary?: Muscle[]];

const ROWS: Row[] = [
  // Chest
  ['barbell-bench-press', 'Barbell Bench Press', 'weight_reps', 'chest', 'barbell', ['triceps', 'shoulders']],
  ['incline-dumbbell-press', 'Incline Dumbbell Press', 'weight_reps', 'chest', 'dumbbell', ['shoulders', 'triceps']],
  ['dumbbell-fly', 'Dumbbell Fly', 'weight_reps', 'chest', 'dumbbell'],
  ['machine-chest-press', 'Machine Chest Press', 'weight_reps', 'chest', 'machine', ['triceps']],
  ['cable-crossover', 'Cable Crossover', 'weight_reps', 'chest', 'cable'],
  ['push-up', 'Push-Up', 'bodyweight_reps', 'chest', 'bodyweight', ['triceps', 'shoulders']],
  ['chest-dip', 'Chest Dip', 'bodyweight_reps', 'chest', 'bodyweight', ['triceps']],
  // Back
  ['deadlift', 'Deadlift', 'weight_reps', 'lower_back', 'barbell', ['glutes', 'hamstrings', 'traps']],
  ['barbell-row', 'Barbell Row', 'weight_reps', 'upper_back', 'barbell', ['lats', 'biceps']],
  ['one-arm-dumbbell-row', 'One-Arm Dumbbell Row', 'weight_reps', 'lats', 'dumbbell', ['biceps']],
  ['pull-up', 'Pull-Up', 'bodyweight_reps', 'lats', 'bodyweight', ['biceps']],
  ['chin-up', 'Chin-Up', 'bodyweight_reps', 'lats', 'bodyweight', ['biceps']],
  ['assisted-pull-up', 'Assisted Pull-Up', 'bodyweight_assisted_reps', 'lats', 'machine', ['biceps']],
  ['lat-pulldown', 'Lat Pulldown', 'weight_reps', 'lats', 'cable', ['biceps']],
  ['seated-cable-row', 'Seated Cable Row', 'weight_reps', 'upper_back', 'cable', ['lats', 'biceps']],
  ['face-pull', 'Face Pull', 'weight_reps', 'upper_back', 'cable', ['shoulders']],
  // Shoulders
  ['overhead-press', 'Overhead Press', 'weight_reps', 'shoulders', 'barbell', ['triceps']],
  ['dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'weight_reps', 'shoulders', 'dumbbell', ['triceps']],
  ['lateral-raise', 'Lateral Raise', 'weight_reps', 'shoulders', 'dumbbell'],
  ['rear-delt-fly', 'Rear Delt Fly', 'weight_reps', 'shoulders', 'dumbbell', ['upper_back']],
  ['barbell-shrug', 'Barbell Shrug', 'weight_reps', 'traps', 'barbell'],
  // Arms
  ['barbell-curl', 'Barbell Curl', 'weight_reps', 'biceps', 'barbell', ['forearms']],
  ['dumbbell-curl', 'Dumbbell Curl', 'weight_reps', 'biceps', 'dumbbell'],
  ['hammer-curl', 'Hammer Curl', 'weight_reps', 'biceps', 'dumbbell', ['forearms']],
  ['triceps-pushdown', 'Triceps Pushdown', 'weight_reps', 'triceps', 'cable'],
  ['skull-crusher', 'Skull Crusher', 'weight_reps', 'triceps', 'barbell'],
  ['overhead-triceps-extension', 'Overhead Triceps Extension', 'weight_reps', 'triceps', 'dumbbell'],
  ['assisted-dip', 'Assisted Dip', 'bodyweight_assisted_reps', 'triceps', 'machine', ['chest']],
  // Legs
  ['back-squat', 'Back Squat', 'weight_reps', 'quads', 'barbell', ['glutes', 'hamstrings']],
  ['front-squat', 'Front Squat', 'weight_reps', 'quads', 'barbell', ['glutes']],
  ['goblet-squat', 'Goblet Squat', 'weight_reps', 'quads', 'kettlebell', ['glutes']],
  ['leg-press', 'Leg Press', 'weight_reps', 'quads', 'machine', ['glutes']],
  ['romanian-deadlift', 'Romanian Deadlift', 'weight_reps', 'hamstrings', 'barbell', ['glutes', 'lower_back']],
  ['walking-lunge', 'Walking Lunge', 'weight_reps', 'quads', 'dumbbell', ['glutes']],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'weight_reps', 'quads', 'dumbbell', ['glutes']],
  ['leg-extension', 'Leg Extension', 'weight_reps', 'quads', 'machine'],
  ['leg-curl', 'Leg Curl', 'weight_reps', 'hamstrings', 'machine'],
  ['hip-thrust', 'Hip Thrust', 'weight_reps', 'glutes', 'barbell', ['hamstrings']],
  ['standing-calf-raise', 'Standing Calf Raise', 'weight_reps', 'calves', 'machine'],
  // Core
  ['plank', 'Plank', 'duration', 'abs', 'bodyweight'],
  ['hanging-leg-raise', 'Hanging Leg Raise', 'reps_only', 'abs', 'bodyweight'],
  ['crunch', 'Crunch', 'reps_only', 'abs', 'bodyweight'],
  ['cable-crunch', 'Cable Crunch', 'weight_reps', 'abs', 'cable'],
  ['ab-wheel-rollout', 'Ab Wheel Rollout', 'reps_only', 'abs', 'other'],
  // Carries, holds and cardio
  ['farmers-carry', 'Farmer’s Carry', 'weight_duration', 'forearms', 'dumbbell', ['traps', 'abs']],
  ['dead-hang', 'Dead Hang', 'duration', 'forearms', 'bodyweight', ['lats']],
  ['wall-sit', 'Wall Sit', 'duration', 'quads', 'bodyweight'],
  ['treadmill-run', 'Treadmill Run', 'distance_duration', 'cardio', 'machine'],
  ['rowing-machine', 'Rowing Machine', 'distance_duration', 'cardio', 'machine', ['full_body']],
  ['stationary-bike', 'Stationary Bike', 'distance_duration', 'cardio', 'machine', ['quads']],
  // Arms (more)
  ['preacher-curl', 'Preacher Curl', 'weight_reps', 'biceps', 'barbell', ['forearms']],
  ['machine-preacher-curl', 'Machine Preacher Curl', 'weight_reps', 'biceps', 'machine'],
  ['ez-bar-curl', 'EZ-Bar Curl', 'weight_reps', 'biceps', 'barbell', ['forearms']],
  ['incline-dumbbell-curl', 'Incline Dumbbell Curl', 'weight_reps', 'biceps', 'dumbbell'],
  ['concentration-curl', 'Concentration Curl', 'weight_reps', 'biceps', 'dumbbell'],
  ['cable-curl', 'Cable Curl', 'weight_reps', 'biceps', 'cable'],
  ['reverse-curl', 'Reverse Barbell Curl', 'weight_reps', 'forearms', 'barbell', ['biceps']],
  ['seated-palms-up-wrist-curl', 'Seated Palms-Up Wrist Curl', 'weight_reps', 'forearms', 'dumbbell'],
  ['seated-palms-down-wrist-curl', 'Seated Palms-Down Wrist Curl', 'weight_reps', 'forearms', 'dumbbell'],
  ['barbell-wrist-curl', 'Barbell Wrist Curl', 'weight_reps', 'forearms', 'barbell'],
  ['rope-triceps-pushdown', 'Rope Triceps Pushdown', 'weight_reps', 'triceps', 'cable'],
  ['cable-overhead-triceps-extension', 'Cable Overhead Triceps Extension', 'weight_reps', 'triceps', 'cable'],
  ['triceps-dip', 'Triceps Dip', 'bodyweight_reps', 'triceps', 'bodyweight', ['chest', 'shoulders']],
  // Chest, back, shoulders (more)
  ['dumbbell-bench-press', 'Dumbbell Bench Press', 'weight_reps', 'chest', 'dumbbell', ['triceps', 'shoulders']],
  ['incline-barbell-bench-press', 'Incline Barbell Bench Press', 'weight_reps', 'chest', 'barbell', ['shoulders', 'triceps']],
  ['close-grip-bench-press', 'Close-Grip Bench Press', 'weight_reps', 'triceps', 'barbell', ['chest']],
  ['pec-deck', 'Pec Deck', 'weight_reps', 'chest', 'machine'],
  ['dumbbell-row', 'Dumbbell Row', 'weight_reps', 'upper_back', 'dumbbell', ['lats', 'biceps']],
  ['arnold-press', 'Arnold Press', 'weight_reps', 'shoulders', 'dumbbell', ['triceps']],
  ['machine-shoulder-press', 'Machine Shoulder Press', 'weight_reps', 'shoulders', 'machine', ['triceps']],
  ['upright-row', 'Upright Row', 'weight_reps', 'shoulders', 'barbell', ['traps']],
  ['reverse-pec-deck', 'Reverse Pec Deck', 'weight_reps', 'shoulders', 'machine', ['upper_back']],
  ['dumbbell-shrug', 'Dumbbell Shrug', 'weight_reps', 'traps', 'dumbbell'],
  // Legs and hips (more)
  ['sumo-deadlift', 'Sumo Deadlift', 'weight_reps', 'glutes', 'barbell', ['quads', 'hamstrings']],
  ['hack-squat', 'Hack Squat', 'weight_reps', 'quads', 'machine', ['glutes']],
  ['step-up', 'Step-Up', 'weight_reps', 'quads', 'dumbbell', ['glutes']],
  ['glute-bridge', 'Glute Bridge', 'bodyweight_reps', 'glutes', 'bodyweight', ['hamstrings']],
  ['seated-calf-raise', 'Seated Calf Raise', 'weight_reps', 'calves', 'machine'],
  ['good-morning', 'Good Morning', 'weight_reps', 'hamstrings', 'barbell', ['lower_back', 'glutes']],
  ['back-extension', 'Back Extension', 'bodyweight_reps', 'lower_back', 'bodyweight', ['glutes', 'hamstrings']],
  // Core and cardio (more)
  ['lying-leg-raise', 'Lying Leg Raise', 'reps_only', 'abs', 'bodyweight'],
  ['russian-twist', 'Russian Twist', 'reps_only', 'abs', 'bodyweight'],
  ['elliptical', 'Elliptical Trainer', 'distance_duration', 'cardio', 'machine'],
  ['jump-rope', 'Jump Rope', 'duration', 'cardio', 'other'],
];

export const SEED_PREFIX = 'seed:';

export const SEED_EXERCISES: ExerciseDef[] = ROWS.map(([slug, title, type, primaryMuscle, equipment, secondary]) => ({
  id: `${SEED_PREFIX}${slug}`,
  title,
  type,
  primaryMuscle,
  secondaryMuscles: secondary ?? [],
  equipment,
  isCustom: false,
}));

/** Built-in exercises followed by the user's, sorted by title. */
export function allExercises(customs: ExerciseDef[]): ExerciseDef[] {
  return [...SEED_EXERCISES, ...customs].sort((a, b) => a.title.localeCompare(b.title));
}

export function exerciseMap(customs: ExerciseDef[]): Map<string, ExerciseDef> {
  return new Map([...SEED_EXERCISES, ...customs].map((e) => [e.id, e]));
}

/** Lower-cased words of a query; punctuation (including the curly apostrophe) is ignored. */
const words = (s: string) => s.toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(Boolean);

export type CatalogFilter = { query?: string; muscle?: Muscle | null; equipment?: Equipment | null };

/** Every query word must prefix-match some word of the title; titles starting with the query rank first. */
export function searchExercises(list: ExerciseDef[], f: CatalogFilter): ExerciseDef[] {
  const q = words(f.query ?? '');
  const scored: { e: ExerciseDef; rank: number }[] = [];
  for (const e of list) {
    if (f.muscle && e.primaryMuscle !== f.muscle && !e.secondaryMuscles.includes(f.muscle)) continue;
    if (f.equipment && e.equipment !== f.equipment) continue;
    const tw = words(e.title);
    if (!q.every((w) => tw.some((t) => t.startsWith(w)))) continue;
    const starts = q.length > 0 && tw[0]?.startsWith(q[0]);
    scored.push({ e, rank: starts ? 0 : 1 });
  }
  return scored.sort((a, b) => a.rank - b.rank || a.e.title.localeCompare(b.e.title)).map((s) => s.e);
}

/** Case-insensitive title match (used by imports). */
export function findByTitle(list: ExerciseDef[], title: string): ExerciseDef | undefined {
  const key = title.trim().toLowerCase();
  return list.find((e) => e.title.trim().toLowerCase() === key);
}
