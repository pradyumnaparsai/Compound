import { Alert } from 'react-native';
import { friendlyError } from '@/domain/errors';

/** Calm alert with one short sentence; the raw error goes to the log only. */
export function notifyError(e: unknown, title: string, fallback?: string) {
  console.warn(title, e);
  Alert.alert(title, friendlyError(e, fallback));
}

/** For `.catch(onFail())` on fire-and-forget actions that used to fail silently. */
export const onFail =
  (title = 'That did not work', fallback = 'Something went wrong. Please try again.') =>
  (e: unknown) =>
    notifyError(e, title, fallback);
