// Rest timer maths. The timer stores an absolute end time (epoch ms) and works out what is left from the clock,
// so it stays right after the app was backgrounded or the screen was locked (a decrementing counter would not).

export const remainingSeconds = (endsAt: number | null, now: number): number =>
  endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));

/** Adds (or removes) seconds; the result is never earlier than `now`. */
export const adjustEnd = (endsAt: number, deltaSeconds: number, now: number): number => Math.max(now, endsAt + deltaSeconds * 1000);

export const restProgress = (endsAt: number | null, totalSeconds: number, now: number): number =>
  totalSeconds <= 0 ? 0 : Math.min(1, Math.max(0, remainingSeconds(endsAt, now) / totalSeconds));
