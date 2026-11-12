const mockNative = { start: jest.fn(), finish: jest.fn(), discard: jest.fn() };
let nativePresent = true;

jest.mock('expo', () => ({
  requireOptionalNativeModule: () => (nativePresent ? mockNative : null),
}));
jest.mock('@kingstinct/react-native-healthkit', () => ({
  isHealthDataAvailable: async () => true,
  requestAuthorization: async () => true,
}));

import { discardLiveStrengthSession, finishLiveStrengthSession, startLiveStrengthSession } from '@/services/health';

beforeEach(() => {
  jest.clearAllMocks();
  mockNative.start.mockResolvedValue(true);
  mockNative.finish.mockResolvedValue(true);
  mockNative.discard.mockResolvedValue(undefined);
});

describe('live strength session bridge', () => {
  it('starts the native session at the given instant (epoch ms)', async () => {
    const at = new Date('2026-11-03T18:00:00.000Z');
    await expect(startLiveStrengthSession(at)).resolves.toBe(true);
    expect(mockNative.start).toHaveBeenCalledWith(at.getTime());
  });

  it('reports false instead of throwing when the native start fails', async () => {
    mockNative.start.mockRejectedValueOnce(new Error('iOS 25: unavailable'));
    await expect(startLiveStrengthSession(new Date())).resolves.toBe(false);
  });

  it('finish hands over the end instant and returns whether Health got the workout', async () => {
    const end = new Date('2026-11-03T18:45:00.000Z');
    await expect(finishLiveStrengthSession(end)).resolves.toBe(true);
    expect(mockNative.finish).toHaveBeenCalledWith(end.getTime());
    mockNative.finish.mockResolvedValueOnce(false); // no session (app restarted)
    await expect(finishLiveStrengthSession(end)).resolves.toBe(false);
  });

  it('finish and discard wait for a start still in flight', async () => {
    let release!: (v: boolean) => void;
    mockNative.start.mockReturnValueOnce(new Promise<boolean>((r) => (release = r)));
    const started = startLiveStrengthSession(new Date());
    await new Promise((r) => setTimeout(r, 0));
    const finished = finishLiveStrengthSession(new Date());
    await new Promise((r) => setTimeout(r, 0));
    expect(mockNative.finish).not.toHaveBeenCalled();
    release(true);
    await started;
    await finished;
    expect(mockNative.finish).toHaveBeenCalledTimes(1);
  });

  it('discard never throws', async () => {
    mockNative.discard.mockRejectedValueOnce(new Error('boom'));
    await expect(discardLiveStrengthSession()).resolves.toBeUndefined();
  });
});
