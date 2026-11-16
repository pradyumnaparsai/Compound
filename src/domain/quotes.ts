/** Short lines from James Clear's "Atomic Habits" about small habits compounding into big change. */
export type Quote = { text: string };

export const QUOTE_SOURCE = 'Atomic Habits, James Clear';

export const QUOTES: readonly Quote[] = [
  { text: 'Habits are the compound interest of self-improvement.' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.' },
  { text: 'Every action you take is a vote for the type of person you wish to become.' },
  { text: 'Success is the product of daily habits—not once-in-a-lifetime transformations.' },
  { text: 'If you get 1 percent better each day for one year, you’ll end up thirty-seven times better by the time you’re done.' },
  { text: 'The holy grail of habit change is not a single 1 percent improvement, but a thousand of them.' },
  { text: 'Small habits do not add up. They compound.' },
  { text: 'Time magnifies the margin between success and failure. It will multiply whatever you feed it.' },
  { text: 'Missing once is an accident. Missing twice is the start of a new habit.' },
  { text: 'Goals are good for setting a direction, but systems are best for making progress.' },
  { text: 'The goal is not to run a marathon. The goal is to become a runner.' },
  { text: 'You should be far more concerned with your current trajectory than your current results.' },
  { text: 'The most effective form of motivation is progress.' },
  { text: 'What is rewarded is repeated. What is punished is avoided.' },
  { text: 'Your habits shape your identity, and your identity shapes your habits.' },
  { text: 'True behavior change is identity change.' },
  { text: 'Environment is the invisible hand that shapes human behavior.' },
  { text: 'Be the designer of your world and not merely the consumer of it.' },
  { text: 'Professionals stick to the schedule; amateurs let life get in the way.' },
  { text: 'The purpose of setting goals is to win the game. The purpose of building systems is to continue playing the game.' },
  { text: 'Success is not a goal to reach or a finish line to cross. It is a system to improve, an endless process to refine.' },
  { text: 'Make it obvious. Make it attractive. Make it easy. Make it satisfying.' },
  { text: 'A habit is a behavior that has been repeated enough times to become automatic.' },
];

/** A random index that differs from `last` (so two launches in a row never show the same line). */
export function pickQuoteIndex(count: number, last: number | null, rand: () => number = Math.random): number {
  if (count <= 0) return -1;
  if (count === 1) return 0;
  const idx = Math.min(count - 1, Math.floor(rand() * count));
  return idx === last ? (idx + 1) % count : idx;
}

/** Parses the stored "last shown" index; anything invalid counts as none. */
export const parseQuoteIndex = (raw: string | null): number | null => {
  const n = raw === null ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
};
