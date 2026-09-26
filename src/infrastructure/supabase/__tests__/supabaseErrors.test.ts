import { AppError } from '@/domain/repositories';
import {
  classifySupabaseError,
  reportRawSupabaseErrors,
  type RawSupabaseError,
} from '@/infrastructure/supabase/supabaseErrors';

/**
 * The translation from Supabase's errors to the app's.
 *
 * The errors here are plain objects shaped like the ones Supabase Auth returns
 * — `code`, `status`, `message`, `name` — so nothing is mocked and no network
 * is involved. The messages are deliberately NOT Supabase's real wording in
 * most cases: the classification must hold when that wording changes.
 */

const authError = (code: string, status: number, message = 'reworded upstream') => ({
  name: 'AuthApiError',
  code,
  status,
  message,
});

describe('classifySupabaseError', () => {
  it('reads invalid credentials from the code, not the message', () => {
    const error = classifySupabaseError(authError('invalid_credentials', 400));

    expect(error.kind).toBe('unauthenticated');
    expect(error.reason).toBe('invalidCredentials');
  });

  it('marks an unverified email so the screen can offer verification', () => {
    const error = classifySupabaseError(authError('email_not_confirmed', 400));

    expect(error.reason).toBe('emailNotConfirmed');
  });

  it('treats an expired or wrong code as a problem with the code field', () => {
    const error = classifySupabaseError(authError('otp_expired', 403));

    expect(error.kind).toBe('validation');
    expect(error.reason).toBe('codeInvalidOrExpired');
    expect(error.field).toBe('code');
  });

  it('points a weak password at the password field', () => {
    const error = classifySupabaseError({
      ...authError('weak_password', 422),
      name: 'AuthWeakPasswordError',
    });

    expect(error.reason).toBe('weakPassword');
    expect(error.field).toBe('password');
  });

  it('says which character types a weak password is missing', () => {
    const error = classifySupabaseError({
      name: 'AuthWeakPasswordError',
      code: 'weak_password',
      status: 422,
      reasons: ['characters'],
      message:
        'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~.',
    });

    expect(error.message).toBe(
      'Your password needs at least a lowercase letter, an uppercase letter, a number and a symbol.',
    );
  });

  it('sends an already-registered address to sign in', () => {
    // What Supabase answers when "Confirm email" is off and the address is taken.
    const error = classifySupabaseError(
      authError('user_already_exists', 422, 'User already registered'),
    );

    expect(error.reason).toBe('accountExists');
    expect(error.field).toBe('email');
  });

  it('says a breached password has been seen in a breach', () => {
    const error = classifySupabaseError({
      name: 'AuthWeakPasswordError',
      code: 'weak_password',
      status: 422,
      reasons: ['pwned'],
      message: 'Password is known to be weak and easy to guess.',
    });

    expect(error.message).toMatch(/breach/);
  });

  it('says the email failed to send, rather than something went wrong', () => {
    const error = classifySupabaseError({
      name: 'AuthApiError',
      code: 'unexpected_failure',
      status: 500,
      message: 'Error sending confirmation email',
    });

    expect(error.kind).toBe('server');
    expect(error.message).toMatch(/could not send the verification email/);
  });

  it('classifies an email rate limit as rateLimited, not as a server fault', () => {
    const error = classifySupabaseError(authError('over_email_send_rate_limit', 429));

    expect(error.kind).toBe('rateLimited');
    expect(error.reason).toBe('rateLimited');
    // Retrying straight away is refused again and spends the email allowance.
    expect(error.isRetryable).toBe(false);
  });

  it('carries the wait Supabase states, when it states one', () => {
    const error = classifySupabaseError(
      authError(
        'over_email_send_rate_limit',
        429,
        'For security purposes, you can only request this after 37 seconds.',
      ),
    );

    expect(error.retryAfterSeconds).toBe(37);
  });

  it('invents no wait when Supabase gives none', () => {
    const error = classifySupabaseError(
      authError('over_email_send_rate_limit', 429, 'email rate limit exceeded'),
    );

    expect(error.kind).toBe('rateLimited');
    expect(error.retryAfterSeconds).toBeUndefined();
  });

  it('classifies a bare 429 with no code as rateLimited', () => {
    const error = classifySupabaseError({ status: 429, message: 'Too Many Requests' });

    expect(error.kind).toBe('rateLimited');
  });

  it('classifies a request that never reached the server as network', () => {
    const error = classifySupabaseError({
      name: 'AuthRetryableFetchError',
      status: 0,
      message: 'Failed to fetch',
    });

    expect(error.kind).toBe('network');
    expect(error.isRetryable).toBe(true);
  });

  it('classifies fetch failures by message when there is no status', () => {
    expect(classifySupabaseError(new TypeError('Network request failed')).kind).toBe('network');
  });

  it('classifies a 5xx as a server error', () => {
    const error = classifySupabaseError({ name: 'AuthApiError', status: 500, message: 'boom' });

    expect(error.kind).toBe('server');
    expect(error.isRetryable).toBe(true);
  });

  it('treats a revoked refresh token as a session that has ended', () => {
    const error = classifySupabaseError(authError('refresh_token_not_found', 400));

    expect(error.kind).toBe('unauthenticated');
    expect(error.reason).toBe('sessionExpired');
  });

  it('never shows Supabase’s own wording for an auth error', () => {
    const error = classifySupabaseError(
      authError('invalid_credentials', 400, 'Invalid login credentials'),
    );

    expect(error.message).not.toBe('Invalid login credentials');
  });

  it('still classifies database errors by their Postgres code', () => {
    expect(classifySupabaseError({ code: '42501', message: 'rls' }).kind).toBe('forbidden');
    expect(classifySupabaseError({ code: 'PGRST116', message: 'none' }).kind).toBe('notFound');
  });

  it('keeps the original error for logging', () => {
    const original = authError('invalid_credentials', 400);
    expect(classifySupabaseError(original).cause).toBe(original);
  });

  it('passes an AppError through untouched', () => {
    const error = new AppError('validation', 'already classified');
    expect(classifySupabaseError(error)).toBe(error);
  });
});

/** Exactly what PostgREST returned for a read of api_v1 before it was exposed. */
const SCHEMA_NOT_EXPOSED = {
  code: 'PGRST106',
  details: null,
  hint: 'Only the following schemas are exposed: public, graphql_public',
  message: 'Invalid schema: api_v1',
};

const NOT_IN_SCHEMA_CACHE = {
  code: 'PGRST205',
  details: null,
  hint: null,
  message: "Could not find the table 'api_v1.candidates_today' in the schema cache",
};

afterEach(() => reportRawSupabaseErrors(null));

describe('classifySupabaseError: api_v1 codes and the dev reporter', () => {
  it.each([
    ['PGRST106, schema not exposed', SCHEMA_NOT_EXPOSED],
    ['PGRST205, not in the schema cache', NOT_IN_SCHEMA_CACHE],
  ])('treats %s as the server not being wired up', (_name, raw) => {
    const error = classifySupabaseError(raw);

    // Not the member's fault, and a retry after the fix succeeds — so the
    // Retry button is offered.
    expect(error.kind).toBe('server');
    expect(error.isRetryable).toBe(true);
    // The generic line, not the database's: that names schemas and tables.
    expect(error.message).not.toContain('api_v1');
    expect(error.cause).toBe(raw);
  });

  it('does not tell the member to try again when there is nothing to tap', () => {
    const error = classifySupabaseError({ code: 'XX999', message: 'something new' });

    expect(error.kind).toBe('unknown');
    // No Retry button is rendered for an unknown error…
    expect(error.isRetryable).toBe(false);
    // …so the copy must not ask for one.
    expect(error.message).not.toMatch(/try again/i);
  });

  it('reports nothing unless a reporter is registered, which production never does', () => {
    const reporter = jest.fn();
    reportRawSupabaseErrors(reporter);
    reportRawSupabaseErrors(null);

    classifySupabaseError(SCHEMA_NOT_EXPOSED);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('hands the raw error to the dev reporter before replacing it', () => {
    const seen: RawSupabaseError[] = [];
    reportRawSupabaseErrors((raw) => seen.push(raw));

    const error = classifySupabaseError(SCHEMA_NOT_EXPOSED);

    expect(seen).toEqual([
      {
        kind: 'server',
        code: 'PGRST106',
        message: 'Invalid schema: api_v1',
        details: null,
        hint: 'Only the following schemas are exposed: public, graphql_public',
        status: undefined,
      },
    ]);
    // Reporting changes nothing about what the member is shown.
    expect(error.message).not.toContain('api_v1');
  });

  it('survives a reporter that throws', () => {
    reportRawSupabaseErrors(() => {
      throw new Error('logger broke');
    });

    expect(classifySupabaseError(SCHEMA_NOT_EXPOSED).kind).toBe('server');
  });

  it('passes an AppError through untouched and unreported', () => {
    const reporter = jest.fn();
    reportRawSupabaseErrors(reporter);
    const original = new AppError('forbidden', 'No.');

    expect(classifySupabaseError(original)).toBe(original);
    expect(reporter).not.toHaveBeenCalled();
  });
});
