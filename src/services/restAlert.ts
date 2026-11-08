import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

let player: AudioPlayer | null = null;

/**
 * Rest is over: haptic + a short chime. Only works while the app is running (a backgrounded app cannot play
 * sounds without local notifications, which this build does not have). Never throws.
 */
export function playRestDone() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  try {
    player ??= createAudioPlayer(require('../../assets/sounds/rest-done.wav'));
    void player.seekTo(0);
    player.play();
  } catch (e) {
    if (__DEV__) console.warn('Rest chime failed', e);
  }
}
