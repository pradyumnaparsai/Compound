import * as Updates from 'expo-updates';

let checking = false;

/** Downloads a newer published update and restarts into it right away (otherwise it only applies on the next launch). */
export async function applyUpdateNow(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled || checking) return;
  checking = true;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch (e) {
    if (__DEV__) console.warn('Update check failed', e);
  } finally {
    checking = false;
  }
}
