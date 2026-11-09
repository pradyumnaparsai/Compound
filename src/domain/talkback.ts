export type TalkbackInput = {
  open: boolean;
  talkback: boolean;
  /** The runner finished a turn (reply spoken or muted) and wants the mic reopened. */
  listenNext: boolean;
  phase: 'idle' | 'thinking' | 'speaking';
  /** useVoiceInput state. */
  voice: 'idle' | 'starting' | 'recording' | 'transcribing';
};

/** True when Atomic should reopen the mic by itself: the sheet is open, talkback is on and nothing else is going on. */
export function shouldAutoListen(s: TalkbackInput): boolean {
  return s.open && s.talkback && s.listenNext && s.phase === 'idle' && s.voice === 'idle';
}

/** Short pause before reopening the mic so it does not catch the tail of Atomic's own voice. */
export const TALKBACK_REARM_MS = 350;
