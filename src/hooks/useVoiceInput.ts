import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { UserError } from '@/domain/errors';
import { cleanTranscript, MAX_RECORD_SECONDS } from '@/domain/voice';
import { transcribeAudio } from '@/services/transcribe';

export type VoiceState = 'idle' | 'recording' | 'transcribing';

// Speech only: mono 16 kHz keeps the upload to a few KB.
const SPEECH_PRESET = { ...RecordingPresets.HIGH_QUALITY, sampleRate: 16000, numberOfChannels: 1, bitRate: 32000 };

const tick = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/**
 * Tap once to start recording, tap again to stop. The audio is transcribed and handed to `onText`.
 * Failures go to `onError` (already a thrown error; format it with friendlyError).
 */
export function useVoiceInput(onText: (text: string) => void, onError: (e: unknown) => void, hint?: string) {
  const recorder = useAudioRecorder(SPEECH_PRESET);
  const [state, setState] = useState<VoiceState>('idle');
  const stateRef = useRef<VoiceState>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const autoStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlers = useRef({ onText, onError, hint });
  useEffect(() => {
    handlers.current = { onText, onError, hint }; // always call the latest callbacks (they close over fresh state)
  });

  const set = (s: VoiceState) => {
    stateRef.current = s;
    setState(s);
  };

  const finish = useCallback(async () => {
    if (autoStop.current) clearTimeout(autoStop.current);
    autoStop.current = null;
    set('transcribing');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await recorder.stop();
      setAudioModeAsync({ allowsRecording: false }).catch(() => {}); // leave record mode so playback/other audio recovers
      const uri = recorder.uri;
      if (!uri) throw new UserError('Nothing was recorded. Try again.');
      const text = cleanTranscript(await transcribeAudio(uri, ctrl.signal, handlers.current.hint));
      if (ctrl.signal.aborted) return;
      if (!text) throw new UserError('Could not hear anything. Try again a little closer to the mic.');
      handlers.current.onText(text);
    } catch (e) {
      if (!ctrl.signal.aborted) handlers.current.onError(e);
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      set('idle');
    }
  }, [recorder]);

  const start = useCallback(async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) throw new UserError('Microphone access is off. Allow it in Settings → Compound.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      set('recording');
      tick();
      autoStop.current = setTimeout(() => {
        if (stateRef.current === 'recording') finish();
      }, MAX_RECORD_SECONDS * 1000);
    } catch (e) {
      set('idle');
      handlers.current.onError(e);
    }
  }, [recorder, finish]);

  const toggle = useCallback(() => {
    if (stateRef.current === 'idle') start();
    else if (stateRef.current === 'recording') {
      tick();
      finish();
    }
  }, [start, finish]);

  /** Drops the current take (recording or upload) without delivering any text. */
  const cancel = useCallback(() => {
    if (autoStop.current) clearTimeout(autoStop.current);
    autoStop.current = null;
    abortRef.current?.abort();
    if (stateRef.current === 'recording') recorder.stop().catch(() => {});
    if (stateRef.current !== 'idle') setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    set('idle');
  }, [recorder]);

  // Leaving the screen mid-recording: drop the take and release the mic.
  useEffect(
    () => () => {
      if (autoStop.current) clearTimeout(autoStop.current);
      abortRef.current?.abort();
      if (stateRef.current === 'recording') recorder.stop().catch(() => {});
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    },
    [recorder],
  );

  return { state, toggle, cancel };
}
