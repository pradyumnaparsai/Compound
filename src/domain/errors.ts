/**
 * Turns raw errors (HTTP codes, provider JSON, stack-ish text) into one short, calm sentence.
 * The technical detail is logged by callers; users never see it.
 */

/** An error whose message was written for the user and may be shown as-is. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

/** All AI providers failed. `status` is the last HTTP status (0 = network/timeout, -1 = unusable output). */
export class AnalysisFailed extends Error {
  status: number;
  constructor(technical: string, status: number) {
    super(technical);
    this.name = 'AnalysisFailed';
    this.status = status;
  }
}

export type ErrorKind = 'user' | 'offline' | 'timeout' | 'busy' | 'auth' | 'server' | 'bad_output' | 'credentials' | 'unknown';

const MESSAGES: Record<Exclude<ErrorKind, 'user' | 'unknown'>, string> = {
  offline: 'No internet connection. Check your network and try again.',
  timeout: 'That took too long. Please try again.',
  busy: 'The AI is busy right now. Wait a minute and try again.',
  auth: 'Your API key was not accepted. Check it in Meal settings.',
  server: 'The service is having trouble right now. Try again in a bit.',
  bad_output: 'Could not read the answer. Try again, or describe the food a little differently.',
  credentials: 'Wrong email or password.',
};

const FALLBACK = 'Something went wrong. Please try again.';

function textOf(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return '';
}

function statusOf(e: unknown, text: string): number | null {
  const s = e && typeof e === 'object' ? (e as { status?: unknown }).status : undefined;
  if (typeof s === 'number' && Number.isFinite(s)) return s;
  const m = /\bHTTP (\d{3})\b/.exec(text);
  return m ? Number(m[1]) : null;
}

export function classifyError(e: unknown): ErrorKind {
  if (e instanceof UserError) return 'user';
  const text = textOf(e);
  const status = statusOf(e, text);

  if (/invalid login credentials/i.test(text)) return 'credentials';
  if (status === 0 && /timed? ?out|timeout/i.test(text)) return 'timeout';
  if (status === 0 && /network|fetch|offline/i.test(text)) return 'offline';
  if (/network request failed|network error|failed to fetch|offline|internet connection|enotfound/i.test(text)) return 'offline';
  if (/timed? ?out|timeout|aborterror/i.test(text)) return 'timeout';
  if (status === 429 || /rate.?limit|quota|too many requests|resource.?exhausted/i.test(text)) return 'busy';
  if (status === 401 || status === 403 || /api key|unauthori[sz]ed|permission denied/i.test(text)) return 'auth';
  if (status !== null && status >= 500) return 'server';
  if (status === -1 || /valid json|unexpected response|no ingredients|empty response|unexpected token|malformed|blocked/i.test(text)) {
    return 'bad_output';
  }
  return 'unknown';
}

/** Short, user-facing message. `fallback` is used when the cause is unrecognised. */
export function friendlyError(e: unknown, fallback: string = FALLBACK): string {
  const kind = classifyError(e);
  if (kind === 'user') return (e as Error).message;
  if (kind === 'unknown') return fallback;
  return MESSAGES[kind];
}
