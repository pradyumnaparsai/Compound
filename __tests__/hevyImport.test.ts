import { SEED_EXERCISES } from '@/domain/exerciseCatalog';
import {
  buildImportPlan,
  HEVY_CUSTOM_SLUGS,
  HEVY_SEED_SLUGS,
  inferType,
  parseCsv,
  parseHevyCsv,
  parseHevyDate,
} from '@/domain/hevyImport';
import { patternFor } from '@/domain/poses';
import { toKey } from '@/domain/date';

const HEADER = '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"';
const row = (title: string, start: string, end: string, ex: string, i: number, kg: string, reps: string, extra: { notes?: string; desc?: string; type?: string; ss?: string; km?: string; sec?: string; rpe?: string } = {}) =>
  `"${title}","${start}","${end}","${extra.desc ?? ''}","${ex}",${extra.ss ?? ''},"${(extra.notes ?? '').replace(/"/g, '""')}",${i},"${extra.type ?? 'normal'}",${kg},${reps},${extra.km ?? ''},${extra.sec ?? ''},${extra.rpe ?? ''}`;

// Synthetic export (newest first, like Hevy): Upper 1 twice, Lower 1 twice, one-off cardio day.
const CSV = [
  HEADER,
  row('Upper 1', '3 Nov 2026, 18:58', '3 Nov 2026, 19:45', 'Bench Press (Barbell)', 0, '25', '7', { notes: 'IDR: 60x10, "quoted"', desc: 'Bday, lessgooo' }),
  row('Upper 1', '3 Nov 2026, 18:58', '3 Nov 2026, 19:45', 'Bench Press (Barbell)', 1, '25', '6'),
  row('Upper 1', '3 Nov 2026, 18:58', '3 Nov 2026, 19:45', 'Seated Palms Up Wrist Curl', 0, '7.5', '25', { type: 'warmup' }),
  row('Lower 1', '2 Nov 2026, 18:00', '2 Nov 2026, 18:41', 'Leg Press (Machine)', 0, '105', '8'),
  row('Lower 1', '2 Nov 2026, 18:00', '2 Nov 2026, 18:41', 'Leg Raise Parallel Bars', 0, '', '16'),
  row('Upper 1', '1 Nov 2026, 09:00', '1 Nov 2026, 10:00', 'Bench Press (Barbell)', 0, '20', '8'),
  row('Lower 1', '30 Oct 2026, 23:30', '31 Oct 2026, 00:20', 'Leg Press (Machine)', 0, '100', '10'),
  row('Afternoon workout', '29 Oct 2026, 12:00', '29 Oct 2026, 12:30', 'Brand New Machine', 0, '', '', { sec: '600', km: '2.5' }),
].join('\r\n');

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, commas and newlines inside fields, CRLF and a BOM', () => {
    const rows = parseCsv('\ufeffa,"b,c","say ""hi""","line1\nline2"\r\n\r\n1,2,3,4\r\n');
    expect(rows).toEqual([
      ['a', 'b,c', 'say "hi"', 'line1\nline2'],
      ['1', '2', '3', '4'],
    ]);
  });
  it('keeps empty fields and a last row without a trailing newline', () => {
    expect(parseCsv('a,,c\n,,')).toEqual([['a', '', 'c'], ['', '', '']]);
  });
  it('returns nothing for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('parseHevyDate', () => {
  it('reads Hevy dates as local time', () => {
    const d = parseHevyDate('3 Nov 2026, 18:58')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 3, 18, 58]);
    expect(toKey(d)).toBe('2026-11-03');
  });
  it('rejects garbage and impossible dates', () => {
    expect(parseHevyDate('')).toBeNull();
    expect(parseHevyDate('yesterday')).toBeNull();
    expect(parseHevyDate('31 Feb 2026, 10:00')).toBeNull();
    expect(parseHevyDate('3 Foo 2026, 10:00')).toBeNull();
  });
});

describe('parseHevyCsv', () => {
  const parsed = parseHevyCsv(CSV);
  it('groups rows into workouts and consecutive exercises', () => {
    expect(parsed.workouts).toHaveLength(5);
    const w = parsed.workouts[0];
    expect(w.title).toBe('Upper 1');
    expect(w.notes).toBe('Bday, lessgooo');
    expect(w.exercises.map((e) => [e.title, e.sets.length])).toEqual([['Bench Press (Barbell)', 2], ['Seated Palms Up Wrist Curl', 1]]);
    expect(w.exercises[0].notes).toBe('IDR: 60x10, "quoted"');
    expect(w.exercises[1].sets[0].setType).toBe('warmup');
    expect(parsed.skippedRows).toBe(0);
  });
  it('keeps blank weights as null and converts km to metres', () => {
    expect(parsed.workouts[1].exercises[1].sets[0]).toMatchObject({ weightKg: null, reps: 16 });
    expect(parsed.workouts[4].exercises[0].sets[0]).toMatchObject({ distanceMeters: 2500, durationSeconds: 600, reps: null });
  });
  it('handles workouts that cross midnight', () => {
    const w = parsed.workouts[3];
    expect(w.endedAt.getTime() - w.startedAt.getTime()).toBe(50 * 60 * 1000);
  });
  it('skips rows with a bad date or no exercise, and rejects other CSVs', () => {
    const bad = `${HEADER}\n"A","nope","x","","Bench Press (Barbell)",,"",0,"normal",1,1,,,\n"A","3 Nov 2026, 10:00","3 Nov 2026, 11:00","","",,"",0,"normal",1,1,,,`;
    expect(parseHevyCsv(bad)).toEqual({ workouts: [], skippedRows: 2 });
    expect(() => parseHevyCsv('foo,bar\n1,2')).toThrow(/Hevy/);
    expect(parseHevyCsv('')).toEqual({ workouts: [], skippedRows: 0 });
  });
});

describe('buildImportPlan', () => {
  let n = 0;
  const makeId = () => `id${++n}`;
  const plan = buildImportPlan(parseHevyCsv(CSV), { makeId });

  it('makes a template per repeated title, ordered by when each routine started, from the latest session', () => {
    expect(plan.templates.map((t) => t.template.title)).toEqual(['Lower 1', 'Upper 1']); // Lower 1 started 30 Oct, Upper 1 on 1 Nov
    const upper = plan.templates[1].template;
    expect(upper.exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([
      ['seed:barbell-bench-press', 2],
      ['seed:seated-palms-up-wrist-curl', 1],
    ]);
    expect(upper.exercises[1].sets[0].setType).toBe('warmup');
    // values come from history next time, not from stale numbers
    expect(upper.exercises.every((e) => e.sets.every((s) => s.weightKg === null && s.reps === null))).toBe(true);
    expect(plan.templates.map((t) => t.template.position)).toEqual([0, 1]);
  });

  it('does not make a template for a one-off workout, but still imports it', () => {
    expect(plan.templates.find((t) => t.template.title === 'Afternoon workout')).toBeUndefined();
    const one = plan.workouts.find((w) => w.workout.title === 'Afternoon workout')!;
    expect(one.workout.templateId).toBeNull();
  });

  it('imports every workout as finished with all sets ticked, linked to its template', () => {
    expect(plan.workouts).toHaveLength(5);
    const lowerId = plan.templates[0].template.id;
    for (const { workout: w } of plan.workouts.filter((x) => x.workout.title === 'Lower 1')) expect(w.templateId).toBe(lowerId);
    for (const { workout: w } of plan.workouts) {
      expect(w.endedAt).not.toBeNull();
      expect(w.exercises.every((e) => e.sets.every((s) => s.isCompleted))).toBe(true);
      expect(w.date).toBe(toKey(new Date(w.startedAt)));
    }
    const first = plan.workouts[0].workout; // oldest first
    expect(first.title).toBe('Afternoon workout');
  });

  it('gives each workout a stable source id and keeps notes and rpe/duration fields', () => {
    const ids = plan.workouts.map((w) => w.sourceId);
    expect(new Set(ids).size).toBe(5);
    const again = buildImportPlan(parseHevyCsv(CSV), { makeId: () => `x${++n}` });
    expect(again.workouts.map((w) => w.sourceId)).toEqual(ids);
    const bench = plan.workouts.find((w) => w.workout.title === 'Upper 1' && w.workout.notes)!.workout.exercises[0];
    expect(bench.notes).toBe('IDR: 60x10, "quoted"');
  });

  it('maps known titles to built-ins, creates custom exercises for the rest, infers unknown ones', () => {
    const byId = new Map(plan.exercises.map((e) => [e.def.id, e.def]));
    expect(byId.has('seed:leg-press')).toBe(false); // built-ins are not created
    expect(byId.get('hevy:leg-raise-parallel-bars')).toMatchObject({ title: 'Leg Raise Parallel Bars', type: 'reps_only', isCustom: true });
    expect(byId.get('hevy:brand-new-machine')).toMatchObject({ title: 'Brand New Machine', type: 'distance_duration', primaryMuscle: 'other' });
  });

  it('links to templates that already exist instead of duplicating them', () => {
    const p = buildImportPlan(parseHevyCsv(CSV), { makeId, existingTemplates: { 'upper 1': 'EXISTING' }, templateStart: 7 });
    expect(p.templates.map((t) => t.template.title)).toEqual(['Lower 1']);
    expect(p.templates[0].template.position).toBe(7);
    expect(p.workouts.filter((w) => w.workout.title === 'Upper 1').every((w) => w.workout.templateId === 'EXISTING')).toBe(true);
  });
});

describe('exercise mapping', () => {
  it('every built-in it points at exists', () => {
    const slugs = new Set(SEED_EXERCISES.map((e) => e.id.replace('seed:', '')));
    expect(HEVY_SEED_SLUGS.filter((s) => !slugs.has(s))).toEqual([]);
  });
  it('every custom exercise it creates has a matching animation', () => {
    for (const slug of HEVY_CUSTOM_SLUGS) expect(patternFor(`hevy:${slug}`, 'other')).not.toBeNull();
  });
  it('infers the type from the filled columns', () => {
    const s = (o: Partial<Parameters<typeof inferType>[0][number]>) => ({ setType: 'normal' as const, weightKg: null, reps: null, durationSeconds: null, distanceMeters: null, rpe: null, ...o });
    expect(inferType([s({ weightKg: 20, reps: 5 })])).toBe('weight_reps');
    expect(inferType([s({ reps: 12 })])).toBe('reps_only');
    expect(inferType([s({ durationSeconds: 30 })])).toBe('duration');
    expect(inferType([s({ durationSeconds: 30, weightKg: 20 })])).toBe('weight_duration');
    expect(inferType([s({ distanceMeters: 100, durationSeconds: 30 })])).toBe('distance_duration');
  });
});
