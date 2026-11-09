import { shouldAutoListen, type TalkbackInput } from '../src/domain/talkback';

const base: TalkbackInput = { open: true, talkback: true, listenNext: true, phase: 'idle', voice: 'idle' };

describe('shouldAutoListen', () => {
  it('re-opens the mic when a turn finished and everything is quiet', () => {
    expect(shouldAutoListen(base)).toBe(true);
  });

  it.each([
    ['sheet closed', { open: false }],
    ['talkback off', { talkback: false }],
    ['no turn finished', { listenNext: false }],
    ['still thinking', { phase: 'thinking' }],
    ['still speaking', { phase: 'speaking' }],
    ['mic already starting', { voice: 'starting' }],
    ['already recording', { voice: 'recording' }],
    ['transcribing', { voice: 'transcribing' }],
  ] as [string, Partial<TalkbackInput>][])('stays off when %s', (_, patch) => {
    expect(shouldAutoListen({ ...base, ...patch })).toBe(false);
  });
});
