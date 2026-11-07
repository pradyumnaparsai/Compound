import { AnalysisFailed, classifyError, friendlyError, UserError } from '../src/domain/errors';

describe('friendlyError', () => {
  it('passes UserError messages through', () => {
    expect(friendlyError(new UserError('Add a note.'))).toBe('Add a note.');
  });

  it('maps rate limits to a calm "busy" message', () => {
    const e = new AnalysisFailed('groq:m: HTTP 429: Rate limit reached for model in organization org_xxx on tokens per day', 429);
    expect(classifyError(e)).toBe('busy');
    expect(friendlyError(e)).toMatch(/busy/i);
    expect(friendlyError(e)).not.toMatch(/org_xxx|HTTP/);
  });

  it('maps rejected keys', () => {
    expect(classifyError(new AnalysisFailed('x', 401))).toBe('auth');
    expect(classifyError(new Error('gemini:m: HTTP 400: API key not valid. Please pass a valid API key.'))).toBe('auth');
  });

  it('maps server errors', () => {
    expect(classifyError(new AnalysisFailed('x', 503))).toBe('server');
    expect(classifyError(new Error('Open Food Facts HTTP 502'))).toBe('server');
  });

  it('maps offline and timeout', () => {
    expect(classifyError(new Error('Network request failed'))).toBe('offline');
    expect(classifyError(new AnalysisFailed('groq:m: Network error', 0))).toBe('offline');
    expect(classifyError(new AnalysisFailed('groq:m: Timed out', 0))).toBe('timeout');
    expect(classifyError(new Error('Open Food Facts timed out.'))).toBe('timeout');
  });

  it('maps unusable model output', () => {
    expect(classifyError(new AnalysisFailed('x', -1))).toBe('bad_output');
    expect(classifyError(new Error('The model did not return valid JSON.'))).toBe('bad_output');
    expect(classifyError(new Error('No ingredients were identified.'))).toBe('bad_output');
  });

  it('maps supabase login failures (plain objects, not Error)', () => {
    expect(friendlyError({ message: 'Invalid login credentials', status: 400 })).toBe('Wrong email or password.');
  });

  it('uses the caller fallback for unknown errors and never leaks raw text', () => {
    const raw = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: meals.id at /var/mobile/...');
    expect(friendlyError(raw, 'Could not save.')).toBe('Could not save.');
    expect(friendlyError(undefined)).toBe('Something went wrong. Please try again.');
    expect(friendlyError('boom')).toBe('Something went wrong. Please try again.');
  });
});
