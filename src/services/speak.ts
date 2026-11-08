import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import { cleanForSpeech, splitForSpeech } from '@/domain/tts';
import { getGroqKey } from '@/services/mealAnalyzer';

// Natural voice: Groq Orpheus (uses the Groq key already saved for meals). If it is unavailable for any reason the
// device's own voice takes over, preferring an Enhanced/Premium one.
const TTS_URL = 'https://api.groq.com/openai/v1/audio/speech';
const TTS_MODEL = 'canopylabs/orpheus-v1-english';
const TTS_VOICE = 'hannah';
const TTS_TIMEOUT_MS = 15_000;
const PLAY_TIMEOUT_MS = 45_000;
const BACKOFF_MS = 5 * 60_000;

// expo-speech is native: a build made before it was added doesn't have it. Load it lazily.
type SpeechModule = typeof import('expo-speech');
let speech: SpeechModule | null | undefined;
function deviceSpeech(): SpeechModule | null {
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

class TtsError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let run = 0; // bumped by every speak()/stopSpeaking(); older runs notice and stop
let cloudDownUntil = 0;
let current: { stop: () => void } | null = null;
let fetchAbort: AbortController | null = null;

/** Synthesises one chunk with Orpheus. WAV bytes. */
async function synth(text: string, key: string): Promise<Uint8Array> {
  const ctrl = new AbortController();
  fetchAbort = ctrl;
  const timer = setTimeout(() => ctrl.abort(), TTS_TIMEOUT_MS);
  try {
    const res = await fetch(TTS_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: TTS_MODEL, voice: TTS_VOICE, input: text, response_format: 'wav' }),
    });
    if (!res.ok) {
      let detail = '';
      try {
        const j = (await res.json()) as { error?: { message?: string } };
        detail = String(j?.error?.message ?? '').slice(0, 140);
      } catch {}
      throw new TtsError(detail || `HTTP ${res.status}`, res.status);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 100) throw new TtsError('Empty audio', 0);
    return bytes;
  } catch (e) {
    if (e instanceof TtsError) throw e;
    throw new TtsError(ctrl.signal.aborted ? 'Timed out' : 'Network error', 0);
  } finally {
    clearTimeout(timer);
    if (fetchAbort === ctrl) fetchAbort = null;
  }
}

let fileSeq = 0;

/** Plays WAV bytes through the app audio session; resolves when finished, stopped or stuck. */
function playBytes(bytes: Uint8Array): Promise<void> {
  return new Promise<void>((resolve) => {
    const file = new File(Paths.cache, `atomic-voice-${fileSeq++ % 4}.wav`);
    let player: AudioPlayer | null = null;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      try {
        player?.pause();
        player?.remove();
      } catch {}
      try {
        if (file.exists) file.delete();
      } catch {}
      if (current === handle) current = null;
      resolve();
    };
    const handle = { stop: finish };
    current = handle;
    (async () => {
      try {
        file.create({ overwrite: true });
        await file.write(bytes);
        if (done) return finish();
        player = createAudioPlayer({ uri: file.uri });
        player.addListener('playbackStatusUpdate', (s) => {
          if (s.didJustFinish) finish();
        });
        player.volume = 1;
        player.play();
        timer = setTimeout(finish, PLAY_TIMEOUT_MS); // never leave the caller waiting on a player that went quiet
      } catch (e) {
        console.warn('Could not play voice reply', e);
        finish();
      }
    })();
  });
}

let voiceId: string | undefined | null; // null = looked, nothing better than the default

/** Best installed English voice: Premium, then Enhanced, then any English voice. */
async function pickVoice(mod: SpeechModule): Promise<string | undefined> {
  if (voiceId !== undefined) return voiceId ?? undefined;
  try {
    const rank = (v: { language: string; quality?: string }) =>
      (v.quality === 'Premium' ? 30 : v.quality === 'Enhanced' ? 20 : 0) +
      (v.language === 'en-US' ? 3 : v.language === 'en-GB' || v.language === 'en-AU' || v.language === 'en-IN' ? 2 : v.language.startsWith('en') ? 1 : -100);
    const best = (await mod.getAvailableVoicesAsync()).sort((a, b) => rank(b) - rank(a))[0];
    voiceId = best && rank(best) > 0 ? best.identifier : null;
  } catch {
    voiceId = null;
  }
  return voiceId ?? undefined;
}

async function speakOnDevice(text: string, myRun: number): Promise<void> {
  const mod = deviceSpeech();
  if (!mod || myRun !== run) return;
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
  const voice = await pickVoice(mod);
  if (myRun !== run) return;
  await new Promise<void>((resolve) => {
    current = { stop: () => mod.stop().catch(() => {}) };
    try {
      mod.speak(text, {
        voice,
        language: voice ? undefined : 'en-US',
        rate: 0.95,
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

export const cloudVoiceActive = () => Date.now() >= cloudDownUntil;

/**
 * Speaks `text`, replacing anything already being said. Resolves when it ends. `onNote` is called with a short
 * explanation when the natural voice could not be used and the device voice took over.
 */
export async function speak(text: string, onNote?: (note: string) => void): Promise<void> {
  stopSpeaking();
  const myRun = run;
  const chunks = splitForSpeech(cleanForSpeech(text));
  if (chunks.length === 0) return;

  let spoken = 0;
  const key = cloudVoiceActive() ? await getGroqKey() : null;
  if (key && myRun === run) {
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      let next: Promise<Uint8Array> | null = synth(chunks[0], key);
      while (next && spoken < chunks.length) {
        const bytes = await next;
        if (myRun !== run) return;
        next = spoken + 1 < chunks.length ? synth(chunks[spoken + 1], key) : null;
        next?.catch(() => {}); // surfaced when awaited; avoids an unhandled rejection if playback is stopped first
        await playBytes(bytes);
        if (myRun !== run) return;
        spoken++;
      }
      return;
    } catch (e) {
      if (myRun !== run) return;
      const status = e instanceof TtsError ? e.status : 0;
      cloudDownUntil = Date.now() + (status === 400 || status === 403 || status === 404 ? 60 * 60_000 : BACKOFF_MS);
      console.warn('Natural voice failed, using the device voice', e);
      if (status === 400 || status === 403 || status === 404) {
        onNote?.(`Natural voice is off (${e instanceof Error ? e.message : `HTTP ${status}`}). Using the device voice.`);
      }
    }
  }
  const rest = chunks.slice(spoken).join(' ');
  if (rest && myRun === run) await speakOnDevice(rest, myRun);
}

/** Stops speaking at once and cancels anything still being fetched. */
export function stopSpeaking(): void {
  run++;
  fetchAbort?.abort();
  fetchAbort = null;
  const c = current;
  current = null;
  c?.stop();
  deviceSpeech()?.stop().catch(() => {});
}
