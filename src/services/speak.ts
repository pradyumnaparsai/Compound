import * as SecureStore from 'expo-secure-store';

// expo-speech is a native module: a build made before it was added doesn't have it. Load it lazily so the
// assistant still works (silently) instead of crashing the app.
type SpeechModule = typeof import('expo-speech');
let speech: SpeechModule | null | undefined;
function load(): SpeechModule | null {
  if (speech === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      speech = require('expo-speech') as SpeechModule;
    } catch (e) {
      console.warn('expo-speech is not available in this build', e);
      speech = null;
    }
  }
  return speech;
}

const MUTE_KEY = 'assistant.muted';
export const getMuted = async () => (await SecureStore.getItemAsync(MUTE_KEY).catch(() => null)) === '1';
export const setMuted = (m: boolean) =>
  (m ? SecureStore.setItemAsync(MUTE_KEY, '1') : SecureStore.deleteItemAsync(MUTE_KEY)).catch(() => {});

let voiceId: string | undefined | null; // null = looked, nothing better than the default

/** Best installed English voice: premium/enhanced first, preferring Indian then US/UK English. */
async function pickVoice(mod: SpeechModule): Promise<string | undefined> {
  if (voiceId !== undefined) return voiceId ?? undefined;
  try {
    const rank = (v: { language: string; quality?: string }) =>
      (v.quality === 'Premium' ? 30 : v.quality === 'Enhanced' ? 20 : 0) +
      (v.language === 'en-IN' ? 3 : v.language === 'en-US' ? 2 : v.language.startsWith('en') ? 1 : -100);
    const best = (await mod.getAvailableVoicesAsync()).sort((a, b) => rank(b) - rank(a))[0];
    voiceId = best && rank(best) > 0 ? best.identifier : null;
  } catch {
    voiceId = null;
  }
  return voiceId ?? undefined;
}

export const speechAvailable = () => load() !== null;

/** Speaks `text`, replacing anything already being said. Resolves when it ends (or at once if unavailable). */
export async function speak(text: string): Promise<void> {
  const mod = load();
  if (!mod || !text.trim()) return;
  await mod.stop().catch(() => {});
  const voice = await pickVoice(mod);
  await new Promise<void>((resolve) => {
    try {
      mod.speak(text, {
        language: 'en-IN',
        voice,
        rate: 1.0,
        pitch: 1.0,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    } catch {
      resolve();
    }
  });
}

export function stopSpeaking(): void {
  load()?.stop().catch(() => {});
}
