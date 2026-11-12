/** Pure helpers for the celebration features (confetti, "Nth workout" messages). */

/** Share of today's routines + tasks that must be done for the daily celebration. */
export const DAY_GOAL_FRACTION = 0.8;

/** True only on the step that carries `prev` below `threshold` and `next` to or above it. */
export function crossedThreshold(prev: number | null, next: number, threshold = DAY_GOAL_FRACTION): boolean {
  return prev !== null && prev < threshold && next >= threshold;
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd". */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** 1st workout, 10th, 25th, 50th, then every 50 (100, 150, ...). */
export function isWorkoutMilestone(n: number): boolean {
  return n === 1 || n === 10 || n === 25 || (n >= 50 && n % 50 === 0);
}

export type WorkoutCongrats = { text: string; milestone: boolean };

/** The line shown after finishing a workout; `n` is the 1-based number of this workout in the log. */
export function workoutCongrats(n: number): WorkoutCongrats | null {
  if (!Number.isInteger(n) || n < 1) return null;
  const milestone = isWorkoutMilestone(n);
  return {
    milestone,
    text: milestone
      ? n === 1
        ? 'Your first workout is in the books!'
        : `Milestone! You just logged your ${ordinal(n)} workout!`
      : `Congratulations on logging your ${ordinal(n)} workout!`,
  };
}

export type PopParticle = {
  /** Direction in radians (0 = right, clockwise) and distance in px from the origin. */
  angle: number;
  dist: number;
  rotate: number;
  size: number;
  color: number;
  round: boolean;
  /** 0..0.12 of the burst: staggers the start. */
  delay: number;
};

/** A tight radial pop (used around a ticked checkbox): evenly spread directions with a little jitter. */
export function makePop(count: number, rand: () => number = Math.random, colors = 6): PopParticle[] {
  const n = Math.max(0, count);
  return Array.from({ length: n }, (_, i) => ({
    angle: ((i + (rand() - 0.5) * 0.7) / n) * Math.PI * 2,
    dist: 38 + rand() * 54,
    rotate: (rand() - 0.5) * 540,
    size: 5 + Math.floor(rand() * 4),
    color: Math.floor(rand() * colors),
    round: rand() < 0.5,
    delay: rand() * 0.12,
  }));
}

export type Particle = {
  /** Horizontal / vertical launch speed, as a fraction of the screen width per burst. */
  vx: number;
  vy: number;
  rotate: number;
  size: number;
  color: number;
  /** 0..0.25: delays the start so the burst feels organic. */
  delay: number;
};

/** `rand` returns [0, 1); injectable so tests are deterministic. */
export function makeParticles(count: number, rand: () => number = Math.random, colors = 6): Particle[] {
  return Array.from({ length: Math.max(0, count) }, () => {
    const angle = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 0.9; // mostly upward fan
    const speed = 0.35 + rand() * 0.45;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotate: (rand() - 0.5) * 720,
      size: 6 + Math.floor(rand() * 6),
      color: Math.floor(rand() * colors),
      delay: rand() * 0.25,
    };
  });
}

export type Spark = {
  /** Direction in radians and distance in px (before any screen scaling) the spark flies from the burst centre. */
  angle: number;
  dist: number;
  size: number;
  color: number;
};

export type Shell = {
  /** Burst centre as a fraction of screen width / height. */
  x: number;
  y: number;
  /** When the rocket launches, 0..FIREWORK_MAX_START of the show. */
  start: number;
  color: number;
  sparks: Spark[];
};

/** A shell is launched at `start`, rises for FIREWORK_RISE, then bursts over FIREWORK_BURST (fractions of the show). */
export const FIREWORK_RISE = 0.13;
export const FIREWORK_BURST = 0.36;
export const FIREWORK_MAX_START = 0.5;

/**
 * Fireworks show: `shells` rockets with staggered launch times, each bursting into a ring of sparks.
 * Shells launch in the order generated, spread across the width so bursts do not pile up. Every shell finishes
 * before the show ends (start + rise + burst <= 1). `rand` returns [0, 1); injectable for tests.
 */
export function makeFireworks(shells: number, sparksPerShell = 18, rand: () => number = Math.random, colors = 6): Shell[] {
  const n = Math.max(0, Math.floor(shells));
  return Array.from({ length: n }, (_, i) => ({
    x: 0.15 + 0.7 * ((i + rand() * 0.8) / n), // 0.15..0.85, one slot per shell
    y: 0.18 + rand() * 0.3,
    start: n === 1 ? 0 : (i / (n - 1)) * FIREWORK_MAX_START * (0.85 + rand() * 0.15),
    color: Math.floor(rand() * colors),
    sparks: Array.from({ length: Math.max(0, sparksPerShell) }, (_, j) => ({
      angle: ((j + (rand() - 0.5) * 0.5) / sparksPerShell) * Math.PI * 2,
      dist: 60 + rand() * 60,
      size: 3 + Math.floor(rand() * 3),
      color: rand() < 0.7 ? -1 : Math.floor(rand() * colors), // -1 = the shell's own colour
    })),
  }));
}
