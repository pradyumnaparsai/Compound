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
