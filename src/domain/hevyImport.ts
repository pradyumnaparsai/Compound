// Hevy CSV export → Compound workouts and templates. Pure: no storage, no clock.
// Hevy's export has one row per set and no template data, so templates are derived from workout titles that repeat
// (their exercises and set counts come from the most recent session; weights and reps are left empty so the next
// session pre-fills from the last one instead of from stale template numbers).
import { toKey } from './date';
import { SEED_PREFIX } from './exerciseCatalog';
import {
  isSetType,
  renumber,
  type Equipment,
  type ExerciseDef,
  type ExerciseType,
  type Muscle,
  type SetType,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
  type WorkoutTemplate,
} from './workout';

export const HEVY_SOURCE = 'hevy';
export const HEVY_PREFIX = 'hevy:';

// ── CSV ──────────────────────────────────────────────────────────────────────

/** RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF, optional BOM. Blank lines are skipped. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    field = '';
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') endRow();
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "3 Nov 2026, 18:58" → that moment in the device's local time zone; null when it does not parse. */
export function parseHevyDate(s: string): Date | null {
  const m = /^\s*(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*$/.exec(s);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return null;
  const d = new Date(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) || d.getMonth() !== month ? null : d;
}

export type HevySet = {
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  rpe: number | null;
};
export type HevyExercise = { title: string; notes: string; supersetId: string | null; sets: HevySet[] };
export type HevyWorkout = {
  title: string;
  startedAt: Date;
  endedAt: Date;
  notes: string;
  exercises: HevyExercise[];
};

const num = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export type ParsedHevy = { workouts: HevyWorkout[]; skippedRows: number };

/** Groups the per-set rows into workouts (title + start time) and exercises (consecutive rows of one exercise). Newest first, as exported. */
export function parseHevyCsv(text: string): ParsedHevy {
  const rows = parseCsv(text);
  if (rows.length === 0) return { workouts: [], skippedRows: 0 };
  const col = new Map(rows[0].map((h, i) => [h.trim().toLowerCase(), i]));
  for (const need of ['title', 'start_time', 'exercise_title']) {
    if (!col.has(need)) throw new Error('This does not look like a Hevy workout export (missing the "' + need + '" column).');
  }
  const get = (r: string[], name: string) => r[col.get(name) ?? -1] ?? '';

  const byKey = new Map<string, HevyWorkout>();
  const lastExercise = new Map<string, HevyExercise>();
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const started = parseHevyDate(get(r, 'start_time'));
    const exTitle = get(r, 'exercise_title').trim();
    if (!started || !exTitle) {
      skipped++;
      continue;
    }
    const title = get(r, 'title').trim() || 'Workout';
    const key = `${title}|${get(r, 'start_time')}`;
    let w = byKey.get(key);
    if (!w) {
      let ended = parseHevyDate(get(r, 'end_time')) ?? started;
      if (ended.getTime() < started.getTime()) ended = started;
      w = { title, startedAt: started, endedAt: ended, notes: get(r, 'description').trim(), exercises: [] };
      byKey.set(key, w);
    }
    const supersetId = get(r, 'superset_id').trim() || null;
    let ex = lastExercise.get(key);
    if (!ex || ex.title !== exTitle || ex.supersetId !== supersetId) {
      ex = { title: exTitle, notes: get(r, 'exercise_notes').trim(), supersetId, sets: [] };
      w.exercises.push(ex);
      lastExercise.set(key, ex);
    }
    const km = num(get(r, 'distance_km'));
    const st = get(r, 'set_type').trim().toLowerCase();
    ex.sets.push({
      setType: isSetType(st) ? st : 'normal',
      weightKg: num(get(r, 'weight_kg')),
      reps: num(get(r, 'reps')),
      durationSeconds: num(get(r, 'duration_seconds')),
      distanceMeters: km === null ? null : Math.round(km * 1000),
      rpe: num(get(r, 'rpe')),
    });
  }
  return { workouts: [...byKey.values()], skippedRows: skipped };
}

// ── Exercise mapping ─────────────────────────────────────────────────────────

type Custom = { slug: string; type: ExerciseType; primary: Muscle; equipment: Equipment; secondary?: Muscle[] };
type Mapped = { seed: string } | { custom: Custom };
const seed = (slug: string): Mapped => ({ seed: slug });
const custom = (slug: string, type: ExerciseType, primary: Muscle, equipment: Equipment, secondary?: Muscle[]): Mapped => ({
  custom: { slug, type, primary, equipment, secondary },
});

/** Hevy exercise title → the built-in exercise it is, or a custom exercise created for it (id `hevy:<slug>`). */
export const HEVY_EXERCISES: Record<string, Mapped> = {
  'Back Extension (Weighted Hyperextension)': custom('back-extension-weighted', 'weight_reps', 'lower_back', 'other', ['glutes', 'hamstrings']),
  'Behind the Back Bicep Wrist Curl (Barbell)': custom('behind-back-wrist-curl', 'weight_reps', 'forearms', 'barbell'),
  'Bench Press (Barbell)': seed('barbell-bench-press'),
  'Bicep Curl (Dumbbell)': seed('dumbbell-curl'),
  'Butterfly (Pec Deck)': seed('pec-deck'),
  'Cable Crunch': seed('cable-crunch'),
  'Crunch (Machine)': custom('crunch-machine', 'weight_reps', 'abs', 'machine'),
  'EZ Bar Biceps Curl': seed('ez-bar-curl'),
  'Goblet Squat': seed('goblet-squat'),
  'Hammer Curl (Dumbbell)': seed('hammer-curl'),
  'Incline Bench Press (Barbell)': seed('incline-barbell-bench-press'),
  'Incline Chest Press (Machine)': custom('incline-chest-press-machine', 'weight_reps', 'chest', 'machine', ['shoulders', 'triceps']),
  'Lat Pulldown (Cable)': seed('lat-pulldown'),
  'Lat Pulldown (Machine)': custom('lat-pulldown-machine', 'weight_reps', 'lats', 'machine', ['biceps']),
  'Lat Pulldown - Close Grip (Cable)': custom('lat-pulldown-close-grip', 'weight_reps', 'lats', 'cable', ['biceps']),
  'Leg Extension (Machine)': seed('leg-extension'),
  'Leg Press (Machine)': seed('leg-press'),
  'Leg Raise Parallel Bars': custom('leg-raise-parallel-bars', 'reps_only', 'abs', 'bodyweight'),
  'Lying Leg Curl (Machine)': custom('lying-leg-curl-machine', 'weight_reps', 'hamstrings', 'machine'),
  'Overhead Triceps Extension (Cable)': seed('cable-overhead-triceps-extension'),
  'Preacher Curl (Machine)': seed('machine-preacher-curl'),
  'Rear Delt Reverse Fly (Cable)': custom('rear-delt-fly-cable', 'weight_reps', 'shoulders', 'cable', ['upper_back']),
  'Rear Delt Reverse Fly (Machine)': seed('reverse-pec-deck'),
  'Reverse Crunch': custom('reverse-crunch', 'reps_only', 'abs', 'bodyweight'),
  'Romanian Deadlift (Barbell)': seed('romanian-deadlift'),
  'Romanian Deadlift (Dumbbell)': custom('romanian-deadlift-dumbbell', 'weight_reps', 'hamstrings', 'dumbbell', ['glutes', 'lower_back']),
  'Seated Cable Row - V Grip (Cable)': seed('seated-cable-row'),
  'Seated Calf Raise': seed('seated-calf-raise'),
  'Seated Palms Up Wrist Curl': seed('seated-palms-up-wrist-curl'),
  'Seated Row (Machine)': custom('seated-row-machine', 'weight_reps', 'upper_back', 'machine', ['lats', 'biceps']),
  'Shoulder Press (Dumbbell)': seed('dumbbell-shoulder-press'),
  'Single Arm Lateral Raise (Cable)': custom('single-arm-lateral-raise-cable', 'weight_reps', 'shoulders', 'cable'),
  'Single Leg Standing Calf Raise (Machine)': custom('single-leg-calf-raise-machine', 'weight_reps', 'calves', 'machine'),
  'Split Squat (Dumbbell)': custom('split-squat-dumbbell', 'weight_reps', 'quads', 'dumbbell', ['glutes']),
  'Squat (Machine)': custom('squat-machine', 'weight_reps', 'quads', 'machine', ['glutes']),
  'Standing Calf Raise (Machine)': seed('standing-calf-raise'),
  'T Bar Row': custom('t-bar-row', 'weight_reps', 'upper_back', 'barbell', ['lats', 'biceps']),
  'Triceps Extension (Cable)': seed('triceps-pushdown'),
  'Triceps Rope Pushdown': seed('rope-triceps-pushdown'),
};

/** Slugs of the custom exercises the mapping creates (used to give them animations). */
export const HEVY_CUSTOM_SLUGS: string[] = Object.values(HEVY_EXERCISES).flatMap((m) => ('custom' in m ? [m.custom.slug] : []));
/** Slugs of built-in exercises the mapping points at (a test checks they exist). */
export const HEVY_SEED_SLUGS: string[] = Object.values(HEVY_EXERCISES).flatMap((m) => ('seed' in m ? [m.seed] : []));

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'exercise';

/** The exercise type implied by which columns a title's sets filled in (for exercises not in the mapping). */
export function inferType(sets: HevySet[]): ExerciseType {
  const any = (f: (s: HevySet) => boolean) => sets.some(f);
  if (any((s) => (s.distanceMeters ?? 0) > 0)) return 'distance_duration';
  if (any((s) => (s.durationSeconds ?? 0) > 0)) return any((s) => (s.weightKg ?? 0) > 0) ? 'weight_duration' : 'duration';
  if (any((s) => (s.weightKg ?? 0) > 0)) return 'weight_reps';
  return 'reps_only';
}

export type PlannedExercise = { sourceId: string; def: ExerciseDef };
export type PlannedWorkout = { sourceId: string; workout: Workout };
export type PlannedTemplate = { sourceId: string; template: WorkoutTemplate };
export type ImportPlan = { exercises: PlannedExercise[]; workouts: PlannedWorkout[]; templates: PlannedTemplate[] };

export type PlanOptions = {
  makeId: () => string;
  /** Lower-cased title → id of templates that already exist (they are linked to, never duplicated). */
  existingTemplates?: Record<string, string>;
  /** First position for new templates. */
  templateStart?: number;
  /** A title needs at least this many workouts to become a template. */
  minTemplateRuns?: number;
};

/** Stable id Hevy workouts are de-duplicated by (a re-import skips workouts already written). */
export const hevySourceId = (title: string, startedAt: Date) => `${title}|${startedAt.getTime()}`;

export function buildImportPlan(parsed: ParsedHevy, opts: PlanOptions): ImportPlan {
  const { makeId, existingTemplates = {}, templateStart = 0, minTemplateRuns = 2 } = opts;
  const exercises = new Map<string, PlannedExercise>();
  const idFor = new Map<string, string>();

  const resolve = (title: string, sets: HevySet[]): string => {
    const known = idFor.get(title);
    if (known) return known;
    const m = HEVY_EXERCISES[title];
    let id: string;
    if (m && 'seed' in m) id = `${SEED_PREFIX}${m.seed}`;
    else {
      const c = m && 'custom' in m ? m.custom : null;
      id = `${HEVY_PREFIX}${c?.slug ?? slugify(title)}`;
      if (!exercises.has(id)) {
        exercises.set(id, {
          sourceId: title,
          def: {
            id,
            title,
            type: c?.type ?? inferType(sets),
            primaryMuscle: c?.primary ?? 'other',
            secondaryMuscles: c?.secondary ?? [],
            equipment: c?.equipment ?? 'other',
            isCustom: true,
          },
        });
      }
    }
    idFor.set(title, id);
    return id;
  };

  // Oldest first, so templates take their order from when you started each routine.
  const chronological = [...parsed.workouts].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const runs = new Map<string, HevyWorkout[]>();
  for (const w of chronological) runs.set(w.title, [...(runs.get(w.title) ?? []), w]);

  const templates: PlannedTemplate[] = [];
  const templateId = new Map<string, string>();
  let position = templateStart;
  for (const [title, list] of runs) {
    const existing = existingTemplates[title.toLowerCase()];
    if (existing) {
      templateId.set(title, existing);
      continue;
    }
    if (list.length < minTemplateRuns) continue;
    const latest = list[list.length - 1];
    const id = makeId();
    templateId.set(title, id);
    const tplExercises = renumber(
      latest.exercises.map((e, i) => ({
        id: makeId(),
        exerciseId: resolve(e.title, e.sets),
        position: i,
        supersetId: null,
        restSeconds: null,
        notes: '',
        notesPinned: false,
        sets: e.sets.map((x, k) => ({
          id: makeId(),
          index: k,
          setType: x.setType,
          repMin: null,
          repMax: null,
          weightKg: null,
          reps: null,
          durationSeconds: null,
          distanceMeters: null,
        })),
      })),
    );
    templates.push({ sourceId: title, template: { id, title, notes: '', folderId: null, position: position++, exercises: tplExercises } });
  }

  const workouts: PlannedWorkout[] = chronological.map((h) => {
    const supersetIds = new Map<string, string>();
    const exs: WorkoutExercise[] = h.exercises.map((e, i) => {
      let supersetId: string | null = null;
      if (e.supersetId) {
        supersetId = supersetIds.get(e.supersetId) ?? makeId();
        supersetIds.set(e.supersetId, supersetId);
      }
      const sets: WorkoutSet[] = e.sets.map((s, k) => ({
        id: makeId(),
        index: k,
        setType: s.setType,
        weightKg: s.weightKg,
        reps: s.reps,
        durationSeconds: s.durationSeconds,
        distanceMeters: s.distanceMeters,
        rpe: s.rpe,
        isCompleted: true,
        completedAt: h.endedAt.toISOString(),
      }));
      return { id: makeId(), exerciseId: resolve(e.title, e.sets), position: i, supersetId, restSeconds: null, notes: e.notes, notesPinned: false, sets };
    });
    return {
      sourceId: hevySourceId(h.title, h.startedAt),
      workout: {
        id: makeId(),
        title: h.title,
        templateId: templateId.get(h.title) ?? null,
        startedAt: h.startedAt.toISOString(),
        endedAt: h.endedAt.toISOString(),
        date: toKey(h.startedAt),
        notes: h.notes,
        exercises: renumber(exs),
      },
    };
  });

  return { exercises: [...exercises.values()], workouts, templates };
}
