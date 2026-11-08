// Original stick-figure animations for exercises. Each movement pattern is two poses (start, end) given as segment
// angles; the figure is solved with simple forward kinematics and sampled into keyframes the UI interpolates.
// No pictures or third-party artwork: a few hundred bytes of numbers per movement.
import type { Muscle } from './workout';

/**
 * Segment directions are in degrees, from "pointing straight down" (0) towards the right (90 = horizontal forward,
 * 180 = straight up, 270 = horizontal backward). The figure always faces right. Each angle is the direction of the
 * segment from its upper/proximal joint to its lower/distal one (torso: hip → shoulder).
 */
export type Pose = {
  torso: number;
  uarm: number;
  farm: number;
  thigh: number;
  shin: number;
  /** Direction wrist → fingertip; follows the forearm unless given. */
  hand?: number;
  /** The other leg (drawn fainter); only when the movement needs it (lunges, walking). */
  thigh2?: number;
  shin2?: number;
  /** Torso length multiplier (shrugs). */
  tl?: number;
  /** The whole body (and the weight) lifts by this many units (calf raises, jumps). */
  rise?: number;
};

export type Root = 'foot' | 'hip' | 'hand';
export type Scenery = 'none' | 'bench' | 'seat' | 'bar';
export type Load = 'hand' | 'shoulder' | 'hip' | 'knee' | 'none';

export type Pattern = { root: Root; a: Pose; b: Pose; scenery?: Scenery; load?: Load; floor?: boolean };

const BASE: Pose = { torso: 180, uarm: 0, farm: 0, thigh: 0, shin: 0 };
const P = (o: Partial<Pose>): Pose => ({ ...BASE, ...o });

// Limb lengths (units); torso 1.05 ≈ hip to shoulder.
const L = { torso: 1.05, uarm: 0.72, farm: 0.66, hand: 0.24, thigh: 1.0, shin: 1.0, head: 0.3 };

// Frequently reused leg/arm set-ups.
const SEATED = { torso: 185, thigh: 88, shin: 0 };
const LYING = { torso: 270, thigh: 112, shin: 6 };
const BENT = { torso: 120, thigh: 25, shin: -10 };

export const PATTERNS = {
  squat: { root: 'foot', load: 'shoulder', floor: true, a: P({ uarm: 20, farm: 190 }), b: P({ torso: 145, uarm: -15, farm: 155, thigh: 75, shin: -30 }) },
  frontSquat: { root: 'foot', load: 'shoulder', floor: true, a: P({ uarm: 80, farm: 215 }), b: P({ torso: 162, uarm: 62, farm: 197, thigh: 80, shin: -25 }) },
  goblet: { root: 'foot', load: 'hand', floor: true, a: P({ uarm: 30, farm: 150 }), b: P({ torso: 160, uarm: 20, farm: 140, thigh: 80, shin: -25 }) },
  wallSit: { root: 'foot', floor: true, a: P({ thigh: 90, uarm: 0, farm: 0 }), b: P({ thigh: 90, uarm: 0, farm: 0 }) },
  hackSquat: { root: 'foot', load: 'none', floor: true, a: P({ torso: 195, uarm: 0, farm: 40 }), b: P({ torso: 195, uarm: 0, farm: 40, thigh: 78, shin: -25 }) },
  deadlift: { root: 'foot', load: 'hand', floor: true, a: P({}), b: P({ torso: 125, thigh: 35, shin: -12 }) },
  rdl: { root: 'foot', load: 'hand', floor: true, a: P({}), b: P({ torso: 112, thigh: 14, shin: -3 }) },
  goodMorning: { root: 'foot', load: 'shoulder', floor: true, a: P({ uarm: 20, farm: 190 }), b: P({ torso: 112, uarm: -48, farm: 122, thigh: 14, shin: -3 }) },
  backExtension: { root: 'hip', scenery: 'none', a: P({ torso: 25, thigh: -78, shin: -78 }), b: P({ torso: 100, thigh: -78, shin: -78 }) },

  bench: { root: 'hip', scenery: 'bench', load: 'hand', a: P({ ...LYING, uarm: 180, farm: 180 }), b: P({ ...LYING, uarm: 8, farm: 180 }) },
  inclineBench: { root: 'hip', scenery: 'seat', load: 'hand', a: P({ torso: 228, thigh: 88, shin: 0, uarm: 180, farm: 180 }), b: P({ torso: 228, thigh: 88, shin: 0, uarm: -12, farm: 178 }) },
  fly: { root: 'hip', scenery: 'bench', load: 'hand', a: P({ ...LYING, uarm: 180, farm: 180 }), b: P({ ...LYING, uarm: 28, farm: 18 }) },
  crossover: { root: 'foot', load: 'hand', floor: true, a: P({ uarm: 135, farm: 135 }), b: P({ torso: 168, uarm: 28, farm: 18 }) },
  machinePress: { root: 'hip', scenery: 'seat', load: 'hand', a: P({ ...SEATED, uarm: 92, farm: 92 }), b: P({ ...SEATED, uarm: -22, farm: 98 }) },
  pushup: { root: 'foot', floor: true, a: P({ torso: 116, thigh: -64, shin: -64, uarm: 0, farm: 0 }), b: P({ torso: 98, thigh: -80, shin: -80, uarm: -105, farm: 0 }) },
  plank: { root: 'foot', floor: true, a: P({ torso: 103, thigh: -77, shin: -77, uarm: 0, farm: 90 }), b: P({ torso: 105, thigh: -77, shin: -77, uarm: 0, farm: 90 }) },

  ohp: { root: 'foot', load: 'hand', floor: true, a: P({ uarm: 15, farm: 175 }), b: P({ uarm: 180, farm: 180 }) },
  ohpSeated: { root: 'hip', scenery: 'seat', load: 'hand', a: P({ ...SEATED, uarm: 15, farm: 175 }), b: P({ ...SEATED, uarm: 180, farm: 180 }) },
  raise: { root: 'foot', load: 'hand', floor: true, a: P({}), b: P({ uarm: 82, farm: 90 }) },
  rearFly: { root: 'foot', load: 'hand', floor: true, a: P({ ...BENT }), b: P({ ...BENT, uarm: -65, farm: -45 }) },
  shrug: { root: 'foot', load: 'hand', floor: true, a: P({}), b: P({ tl: 1.32 }) },
  upright: { root: 'foot', load: 'hand', floor: true, a: P({}), b: P({ uarm: 150, farm: 10 }) },

  row: { root: 'foot', load: 'hand', floor: true, a: P({ ...BENT }), b: P({ ...BENT, uarm: -72, farm: -8 }) },
  seatedRow: { root: 'hip', scenery: 'seat', load: 'hand', a: P({ torso: 190, thigh: 82, shin: 12, uarm: 90, farm: 90 }), b: P({ torso: 190, thigh: 82, shin: 12, uarm: -95, farm: 85 }) },
  pullup: { root: 'hand', scenery: 'bar', a: P({ shin: -20, uarm: 180, farm: 180 }), b: P({ torso: 175, thigh: -10, shin: -30, uarm: 25, farm: 185 }) },
  hang: { root: 'hand', scenery: 'bar', a: P({ shin: -12, uarm: 180, farm: 180 }), b: P({ shin: -12, uarm: 180, farm: 180 }) },
  pulldown: { root: 'hip', scenery: 'seat', load: 'hand', a: P({ torso: 190, thigh: 88, shin: 0, uarm: 180, farm: 180 }), b: P({ torso: 192, thigh: 88, shin: 0, uarm: 22, farm: 170 }) },
  hangingLegRaise: { root: 'hand', scenery: 'bar', a: P({ uarm: 180, farm: 180, thigh: 0, shin: 0 }), b: P({ uarm: 180, farm: 180, torso: 190, thigh: 86, shin: 86 }) },

  curl: { root: 'foot', load: 'hand', floor: true, a: P({}), b: P({ uarm: 5, farm: 148 }) },
  inclineCurl: { root: 'hip', scenery: 'seat', load: 'hand', a: P({ torso: 228, thigh: 88, shin: 0 }), b: P({ torso: 228, thigh: 88, shin: 0, uarm: 5, farm: 148 }) },
  preacher: { root: 'hip', scenery: 'seat', load: 'hand', a: P({ torso: 172, thigh: 88, shin: 0, uarm: 50, farm: 52 }), b: P({ torso: 172, thigh: 88, shin: 0, uarm: 50, farm: 172 }) },
  wristCurl: { root: 'hip', scenery: 'seat', load: 'hand', a: P({ torso: 150, thigh: 88, shin: 0, uarm: 28, farm: 86, hand: 30 }), b: P({ torso: 150, thigh: 88, shin: 0, uarm: 28, farm: 86, hand: 150 }) },
  pushdown: { root: 'foot', load: 'hand', floor: true, a: P({ torso: 175, uarm: 5, farm: 100 }), b: P({ torso: 175, uarm: 5, farm: 0 }) },
  skull: { root: 'hip', scenery: 'bench', load: 'hand', a: P({ ...LYING, uarm: 184, farm: 184 }), b: P({ ...LYING, uarm: 184, farm: 252 }) },
  overheadExt: { root: 'foot', load: 'hand', floor: true, a: P({ uarm: 180, farm: 180 }), b: P({ uarm: 180, farm: 330 }) },
  dip: { root: 'hand', scenery: 'bar', a: P({ torso: 175, thigh: 5, shin: -35, uarm: 0, farm: 0 }), b: P({ torso: 150, thigh: 5, shin: -35, uarm: -120, farm: 0 }) },

  lunge: { root: 'foot', load: 'hand', floor: true, a: P({ thigh2: 0, shin2: 0 }), b: P({ thigh: 80, shin: -15, thigh2: -35, shin2: -100 }) },
  legPress: { root: 'hip', scenery: 'seat', a: P({ torso: 235, thigh: 125, shin: 116, uarm: 30, farm: 80 }), b: P({ torso: 235, thigh: 152, shin: 82, uarm: 30, farm: 80 }) },
  legExt: { root: 'hip', scenery: 'seat', a: P({ ...SEATED, uarm: 10, farm: 70 }), b: P({ ...SEATED, shin: 90, uarm: 10, farm: 70 }) },
  legCurl: { root: 'hip', scenery: 'seat', a: P({ ...SEATED, shin: 84, uarm: 10, farm: 70 }), b: P({ ...SEATED, shin: -22, uarm: 10, farm: 70 }) },
  calf: { root: 'foot', load: 'shoulder', floor: true, a: P({ uarm: 20, farm: 190 }), b: P({ uarm: 20, farm: 190, rise: 0.34 }) },
  seatedCalf: { root: 'hip', scenery: 'seat', load: 'knee', a: P({ ...SEATED, uarm: 30, farm: 70 }), b: P({ ...SEATED, uarm: 30, farm: 70, rise: 0.16 }) },
  glute: { root: 'foot', load: 'hip', floor: true, a: P({ torso: -45, thigh: 135, shin: -20, uarm: 0, farm: 0 }), b: P({ torso: -80, thigh: 100, shin: -20, uarm: 0, farm: 0 }) },
  stepUp: { root: 'foot', load: 'hand', floor: true, a: P({ thigh: 75, shin: -20, thigh2: 20, shin2: 10 }), b: P({ thigh: 0, shin: 0, thigh2: 10, shin2: 0 }) },

  crunch: { root: 'hip', scenery: 'none', a: P({ torso: 270, thigh: 120, shin: 10, uarm: 250, farm: 90 }), b: P({ torso: 235, thigh: 120, shin: 10, uarm: 215, farm: 55 }) },
  cableCrunch: { root: 'hip', scenery: 'none', load: 'hand', a: P({ torso: 185, thigh: 0, shin: -90, uarm: 150, farm: 20 }), b: P({ torso: 118, thigh: 0, shin: -90, uarm: 83, farm: -47 }) },
  lyingLegRaise: { root: 'hip', scenery: 'none', a: P({ torso: 270, thigh: 85, shin: 85, uarm: 90, farm: 90 }), b: P({ torso: 270, thigh: 175, shin: 175, uarm: 90, farm: 90 }) },
  russianTwist: { root: 'hip', scenery: 'none', load: 'hand', a: P({ torso: 205, thigh: 138, shin: 62, uarm: 70, farm: 70 }), b: P({ torso: 205, thigh: 138, shin: 62, uarm: 112, farm: 112 }) },
  abWheel: { root: 'hip', scenery: 'none', load: 'hand', a: P({ torso: 185, thigh: 0, shin: -90, uarm: 5, farm: 5 }), b: P({ torso: 100, thigh: 0, shin: -90, uarm: 45, farm: 40 }) },

  carry: { root: 'hip', load: 'hand', a: P({ thigh: 22, shin: 0, thigh2: -22, shin2: -30 }), b: P({ thigh: -22, shin: -30, thigh2: 22, shin2: 0 }) },
  run: { root: 'hip', a: P({ torso: 172, thigh: 48, shin: -20, thigh2: -30, shin2: -75, uarm: 40, farm: 110 }), b: P({ torso: 172, thigh: -30, shin: -75, thigh2: 48, shin2: -20, uarm: -40, farm: 70 }) },
  bike: { root: 'hip', scenery: 'seat', a: P({ torso: 145, thigh: 100, shin: 30, thigh2: 30, shin2: -5, uarm: 80, farm: 100 }), b: P({ torso: 145, thigh: 30, shin: -5, thigh2: 100, shin2: 30, uarm: 80, farm: 100 }) },
  rowMachine: { root: 'hip', scenery: 'seat', a: P({ torso: 150, thigh: 150, shin: 60, uarm: 90, farm: 90 }), b: P({ torso: 200, thigh: 92, shin: 8, uarm: -80, farm: 85 }) },
  jumpRope: { root: 'foot', floor: true, a: P({ uarm: 30, farm: 105 }), b: P({ uarm: 30, farm: 105, thigh: 14, shin: -14, rise: 0.35 }) },
} satisfies Record<string, Pattern>;

export type PatternName = keyof typeof PATTERNS;

const SLUG_PATTERN: Record<string, PatternName> = {
  'barbell-bench-press': 'bench', 'dumbbell-bench-press': 'bench', 'close-grip-bench-press': 'bench', 'incline-dumbbell-press': 'inclineBench',
  'incline-barbell-bench-press': 'inclineBench', 'dumbbell-fly': 'fly', 'machine-chest-press': 'machinePress', 'pec-deck': 'machinePress',
  'cable-crossover': 'crossover', 'push-up': 'pushup', 'chest-dip': 'dip', 'triceps-dip': 'dip', 'assisted-dip': 'dip',
  deadlift: 'deadlift', 'sumo-deadlift': 'deadlift', 'romanian-deadlift': 'rdl', 'good-morning': 'goodMorning', 'back-extension': 'backExtension',
  'barbell-row': 'row', 'one-arm-dumbbell-row': 'row', 'dumbbell-row': 'row', 'seated-cable-row': 'seatedRow', 'face-pull': 'seatedRow',
  'pull-up': 'pullup', 'chin-up': 'pullup', 'assisted-pull-up': 'pullup', 'lat-pulldown': 'pulldown', 'dead-hang': 'hang',
  'overhead-press': 'ohp', 'dumbbell-shoulder-press': 'ohpSeated', 'machine-shoulder-press': 'ohpSeated', 'arnold-press': 'ohpSeated',
  'lateral-raise': 'raise', 'rear-delt-fly': 'rearFly', 'reverse-pec-deck': 'rearFly', 'barbell-shrug': 'shrug', 'dumbbell-shrug': 'shrug', 'upright-row': 'upright',
  'barbell-curl': 'curl', 'dumbbell-curl': 'curl', 'hammer-curl': 'curl', 'ez-bar-curl': 'curl', 'cable-curl': 'curl', 'reverse-curl': 'curl',
  'incline-dumbbell-curl': 'inclineCurl', 'preacher-curl': 'preacher', 'machine-preacher-curl': 'preacher', 'concentration-curl': 'preacher',
  'seated-palms-up-wrist-curl': 'wristCurl', 'seated-palms-down-wrist-curl': 'wristCurl', 'barbell-wrist-curl': 'wristCurl',
  'triceps-pushdown': 'pushdown', 'rope-triceps-pushdown': 'pushdown', 'skull-crusher': 'skull',
  'overhead-triceps-extension': 'overheadExt', 'cable-overhead-triceps-extension': 'overheadExt',
  'back-squat': 'squat', 'front-squat': 'frontSquat', 'goblet-squat': 'goblet', 'hack-squat': 'hackSquat', 'wall-sit': 'wallSit',
  'leg-press': 'legPress', 'walking-lunge': 'lunge', 'bulgarian-split-squat': 'lunge', 'step-up': 'stepUp',
  'leg-extension': 'legExt', 'leg-curl': 'legCurl', 'hip-thrust': 'glute', 'glute-bridge': 'glute',
  'standing-calf-raise': 'calf', 'seated-calf-raise': 'seatedCalf',
  plank: 'plank', 'hanging-leg-raise': 'hangingLegRaise', crunch: 'crunch', 'cable-crunch': 'cableCrunch', 'ab-wheel-rollout': 'abWheel',
  'lying-leg-raise': 'lyingLegRaise', 'russian-twist': 'russianTwist',
  'farmers-carry': 'carry', 'treadmill-run': 'run', elliptical: 'run', 'rowing-machine': 'rowMachine', 'stationary-bike': 'bike', 'jump-rope': 'jumpRope',
};

const MUSCLE_PATTERN: Partial<Record<Muscle, PatternName>> = {
  chest: 'bench', lats: 'pulldown', upper_back: 'row', lower_back: 'deadlift', shoulders: 'ohp', traps: 'shrug', biceps: 'curl', triceps: 'pushdown',
  forearms: 'wristCurl', abs: 'crunch', quads: 'squat', hamstrings: 'rdl', glutes: 'glute', calves: 'calf', full_body: 'deadlift', cardio: 'run',
};

/** The animation for an exercise: its own for built-ins, otherwise a sensible guess from the main muscle. */
export function patternFor(id: string, primary?: Muscle): PatternName | null {
  const slug = id.startsWith('seed:') ? id.slice(5) : null;
  if (slug && SLUG_PATTERN[slug]) return SLUG_PATTERN[slug];
  return (primary && MUSCLE_PATTERN[primary]) || null;
}

export const SEED_SLUGS_WITH_PATTERN = Object.keys(SLUG_PATTERN);

// ---------------------------------------------------------------- solving

type Pt = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const dir = (deg: number): Pt => [Math.sin(rad(deg)), Math.cos(rad(deg))];
const add = (p: Pt, d: Pt, len: number): Pt => [p[0] + d[0] * len, p[1] + d[1] * len];
const sub = (p: Pt, d: Pt, len: number): Pt => [p[0] - d[0] * len, p[1] - d[1] * len];

export const SEGMENTS = ['torso', 'uarm', 'farm', 'hand', 'thigh', 'shin', 'foot', 'thigh2', 'shin2', 'foot2', 'floor', 'bench', 'seat', 'bar'] as const;
export type SegKey = (typeof SEGMENTS)[number];
type Seg = [number, number, number, number]; // x1,y1,x2,y2 (y grows downward)

export type Solved = { segs: Partial<Record<SegKey, Seg>>; head: Pt; load: Pt | null };

function solve(root: Root, p: Pose): Solved {
  const tl = L.torso * (p.tl ?? 1);
  const handDir = p.hand ?? p.farm;
  let H: Pt;
  if (root === 'foot') {
    const K0 = sub([0, 0], dir(p.shin), L.shin);
    H = sub(K0, dir(p.thigh), L.thigh);
  } else if (root === 'hand') {
    const E0 = sub([0, 0], dir(p.farm), L.farm);
    const S0 = sub(E0, dir(p.uarm), L.uarm);
    H = sub(S0, dir(p.torso), tl);
  } else H = [0, 0];

  const S = add(H, dir(p.torso), tl);
  const E = add(S, dir(p.uarm), L.uarm);
  const W = add(E, dir(p.farm), L.farm);
  const T = add(W, dir(handDir), L.hand);
  const K = add(H, dir(p.thigh), L.thigh);
  const A = add(K, dir(p.shin), L.shin);
  const lift = p.rise ?? 0;
  const up = ([x, y]: Pt): Pt => [x, y - lift];
  const segs: Solved['segs'] = {
    torso: [...up(H), ...up(S)],
    uarm: [...up(S), ...up(E)],
    farm: [...up(E), ...up(W)],
    hand: [...up(W), ...up(T)],
    thigh: [...up(H), ...up(K)],
    shin: [...up(K), ...up(A)],
    foot: [...up(A), ...up([A[0] + 0.3, A[1]])],
  };
  if (p.thigh2 !== undefined) {
    const K2 = add(H, dir(p.thigh2), L.thigh);
    const A2 = add(K2, dir(p.shin2 ?? p.thigh2), L.shin);
    segs.thigh2 = [...up(H), ...up(K2)];
    segs.shin2 = [...up(K2), ...up(A2)];
    segs.foot2 = [...up(A2), ...up([A2[0] + 0.3, A2[1]])];
  }
  const head = up(add(S, dir(p.torso), L.head + 0.16));
  return { segs, head, load: null };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mix(a: Pose, b: Pose, t: number): Pose {
  const f = (x: number | undefined, y: number | undefined, d: number) => lerp(x ?? y ?? d, y ?? x ?? d, t);
  const out: Pose = {
    torso: lerp(a.torso, b.torso, t), uarm: lerp(a.uarm, b.uarm, t), farm: lerp(a.farm, b.farm, t),
    thigh: lerp(a.thigh, b.thigh, t), shin: lerp(a.shin, b.shin, t),
  };
  if (a.hand !== undefined || b.hand !== undefined) out.hand = f(a.hand ?? a.farm, b.hand ?? b.farm, 0);
  if (a.thigh2 !== undefined || b.thigh2 !== undefined) {
    out.thigh2 = f(a.thigh2, b.thigh2, 0);
    out.shin2 = f(a.shin2 ?? a.thigh2, b.shin2 ?? b.thigh2, 0);
  }
  if (a.tl !== undefined || b.tl !== undefined) out.tl = lerp(a.tl ?? 1, b.tl ?? 1, t);
  if (a.rise !== undefined || b.rise !== undefined) out.rise = lerp(a.rise ?? 0, b.rise ?? 0, t);
  return out;
}

const KEYFRAMES = 12;

export type Drawn = {
  key: SegKey;
  length: number;
  thick: number;
  /** One value per keyframe (px, relative to the figure box). */
  cx: number[];
  cy: number[];
  rot: number[]; // degrees, unwrapped so interpolation never spins the long way round
  soft: boolean; // the far-side leg and scenery are drawn fainter
};
export type Layout = {
  size: number;
  frames: number;
  animated: boolean;
  parts: Drawn[];
  head: { cx: number[]; cy: number[]; r: number };
  load: { cx: number[]; cy: number[]; r: number } | null;
  loadKind: Load;
};

const THICK: Record<SegKey, number> = {
  torso: 0.26, uarm: 0.17, farm: 0.15, hand: 0.12, thigh: 0.22, shin: 0.17, foot: 0.12, thigh2: 0.2, shin2: 0.16, foot2: 0.11,
  floor: 0.05, bench: 0.16, seat: 0.12, bar: 0.07,
};

function scenery(root: Root, kind: Scenery, a: Pose, first: Solved): Partial<Record<SegKey, Seg>> {
  const out: Partial<Record<SegKey, Seg>> = {};
  const t = first.segs.torso as Seg;
  const hip: Pt = [t[0], t[1]];
  const d = dir(a.torso);
  if (kind === 'bench' || kind === 'seat') {
    const n: Pt = [Math.cos(rad(a.torso)), -Math.sin(rad(a.torso))]; // behind/below the back
    const off = 0.24;
    const p1 = add(add(hip, d, -0.15), n, off);
    const p2 = add(add(hip, d, L.torso + 0.55), n, off);
    out.bench = [...p1, ...p2];
    if (kind === 'seat') out.seat = [hip[0] - 0.45, hip[1] + 0.25, hip[0] + 0.45, hip[1] + 0.25];
  }
  if (kind === 'bar') {
    const w = first.segs.farm as Seg;
    out.bar = [w[2] - 0.7, w[3] - 0.02, w[2] + 0.7, w[3] - 0.02];
  }
  return out;
}

/** Everything the UI needs to draw and animate the figure inside a `size` × `size` box. */
export function layoutPattern(name: PatternName, size: number, frames = KEYFRAMES): Layout {
  const pat: Pattern = PATTERNS[name];
  const solved: Solved[] = [];
  for (let i = 0; i < frames; i++) solved.push(solve(pat.root, mix(pat.a, pat.b, i / (frames - 1))));
  const first = solved[0];
  const extra = scenery(pat.root, pat.scenery ?? 'none', pat.a, first);
  const lowest = Math.max(...solved.map((s) => (s.segs.foot as Seg)[1]));
  if (pat.floor) extra.floor = [-1.4, lowest + 0.06, 1.8, lowest + 0.06];

  const loadAt = (s: Solved): Pt | null => {
    const g = s.segs;
    switch (pat.load) {
      case 'hand': return [(g.hand as Seg)[2], (g.hand as Seg)[3]];
      case 'shoulder': return [(g.torso as Seg)[2] - 0.04, (g.torso as Seg)[3] - 0.02];
      case 'hip': return [(g.torso as Seg)[0], (g.torso as Seg)[1]];
      case 'knee': return [(g.thigh as Seg)[2], (g.thigh as Seg)[3] - 0.18];
      default: return null;
    }
  };
  const loads = solved.map(loadAt);

  // bounds over every drawn point
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x: number, y: number) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  for (const s of solved) {
    for (const g of Object.values(s.segs)) { grow(g[0], g[1]); grow(g[2], g[3]); }
    grow(s.head[0] - L.head, s.head[1] - L.head); grow(s.head[0] + L.head, s.head[1] + L.head);
  }
  for (const g of Object.values(extra)) { grow(g[0], g[1]); grow(g[2], g[3]); }
  const pad = 0.2;
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const scale = (size * (1 - 2 * pad)) / span;
  const ox = (size - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (size - (maxY - minY) * scale) / 2 - minY * scale;
  const px = (x: number) => x * scale + ox;
  const py = (y: number) => y * scale + oy;

  const parts: Drawn[] = [];
  const addPart = (key: SegKey, segAt: (i: number) => Seg | undefined, soft: boolean) => {
    const f0 = segAt(0);
    if (!f0) return;
    const cx: number[] = [], cy: number[] = [], rot: number[] = [];
    let prev = 0;
    for (let i = 0; i < frames; i++) {
      const s = segAt(i) as Seg;
      cx.push(px((s[0] + s[2]) / 2));
      cy.push(py((s[1] + s[3]) / 2));
      let a = (Math.atan2(s[3] - s[1], s[2] - s[0]) * 180) / Math.PI;
      if (i > 0) while (a - prev > 180) a -= 360; // keep it continuous with the previous keyframe
      if (i > 0) while (a - prev < -180) a += 360;
      rot.push(a);
      prev = a;
    }
    const length = Math.hypot(f0[2] - f0[0], f0[3] - f0[1]) * scale;
    parts.push({ key, length: Math.max(length, 1), thick: Math.max(THICK[key] * scale, 2.5), cx, cy, rot, soft });
  };
  const withHand = pat.a.hand !== undefined || pat.b.hand !== undefined;
  for (const key of ['bench', 'seat', 'bar', 'floor', 'foot2', 'shin2', 'thigh2'] as SegKey[]) {
    if (key in extra) addPart(key, () => extra[key], true);
    else if (key.endsWith('2') && first.segs[key]) addPart(key, (i) => solved[i].segs[key], true);
  }
  for (const key of ['foot', 'shin', 'thigh', 'torso', 'uarm', 'farm'] as SegKey[]) addPart(key, (i) => solved[i].segs[key], false);
  if (withHand) addPart('hand', (i) => solved[i].segs.hand, false);

  const loadR = Math.max(0.2 * scale, 4);
  const animated = JSON.stringify(pat.a) !== JSON.stringify(pat.b);
  return {
    size,
    frames,
    animated,
    parts,
    head: { cx: solved.map((s) => px(s.head[0])), cy: solved.map((s) => py(s.head[1])), r: Math.max(L.head * scale, 3) },
    load: loads[0] ? { cx: loads.map((l) => px((l as Pt)[0])), cy: loads.map((l) => py((l as Pt)[1])), r: loadR } : null,
    loadKind: pat.load ?? 'none',
  };
}

/** Plain SVG of both end poses side by side; used by the preview script and handy for debugging. */
export function previewSvg(names: PatternName[], cell = 120): string {
  const cols = 3;
  const rows = Math.ceil(names.length / cols);
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell * 2}" height="${rows * (cell + 16)}" style="background:#fff">`];
  names.forEach((n, i) => {
    const lay = layoutPattern(n, cell, 2);
    const ox = (i % cols) * cell * 2;
    const oy = Math.floor(i / cols) * (cell + 16);
    out.push(`<text x="${ox + 4}" y="${oy + 11}" font-size="10" font-family="sans-serif">${n}</text>`);
    for (let f = 0; f < 2; f++) {
      const x0 = ox + f * cell;
      out.push(`<rect x="${x0}" y="${oy + 14}" width="${cell}" height="${cell}" fill="none" stroke="#ddd"/>`);
      for (const p of lay.parts) {
        const col = p.soft ? '#aaa' : f === 0 ? '#3b6' : '#c53';
        out.push(`<rect x="${x0 + p.cx[f] - p.length / 2}" y="${oy + 14 + p.cy[f] - p.thick / 2}" width="${p.length}" height="${p.thick}" rx="${p.thick / 2}" fill="${col}" transform="rotate(${p.rot[f]} ${x0 + p.cx[f]} ${oy + 14 + p.cy[f]})"/>`);
      }
      out.push(`<circle cx="${x0 + lay.head.cx[f]}" cy="${oy + 14 + lay.head.cy[f]}" r="${lay.head.r}" fill="${f === 0 ? '#3b6' : '#c53'}"/>`);
      if (lay.load) out.push(`<circle cx="${x0 + lay.load.cx[f]}" cy="${oy + 14 + lay.load.cy[f]}" r="${lay.load.r}" fill="#333"/>`);
    }
  });
  out.push('</svg>');
  return out.join('\n');
}
