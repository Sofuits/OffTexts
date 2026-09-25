import { AppError, type AppErrorOptions, type ErrorKind } from '@/domain/repositories';

/**
 * Turns whatever Supabase threw into an AppError.
 *
 * This is the translation boundary. Above it nobody knows what a PostgREST
 * error code is; below it, that is all there is. Getting it wrong is costly in
 * a specific way: classify an expired session as 'server' and the app retries
 * forever instead of sending the member to sign in.
 *
 * The order of evidence matters:
 *
 *   1. `code` — Supabase Auth and PostgREST both send a machine-readable code.
 *      It is the only field that is a contract; messages are reworded between
 *      releases.
 *   2. HTTP `status` — for anything without a code we recognise.
 *   3. The message — only to spot a request that never left the device, which
 *      fetch() reports with no status at all, and to read the wait time off a
 *      rate-limit refusal, which Supabase states in words and nowhere else.
 *
 * Database codes (PostgREST and Postgres):
 *   PGRST116  no rows when exactly one was expected
 *   42501     insufficient privilege — in practice, an RLS policy said no
 *   23505     unique violation
 *   23503     foreign key violation
 */

type SupabaseLikeError = {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
  /** AuthWeakPasswordError: why the password was refused. */
  reasons?: unknown;
};

type Classified = { kind: ErrorKind; message: string } & Omit<AppErrorOptions, 'cause'>;

/**
 * Supabase Auth error codes, and what each means to a member.
 *
 * The messages are ours rather than Supabase's. Its own wording is written for
 * developers ("Token has expired or is invalid") and changes between versions.
 */
const AUTH_CODES: Record<string, Classified> = {
  invalid_credentials: {
    kind: 'unauthenticated',
    reason: 'invalidCredentials',
    message: 'That email and password do not match. Check them and try again.',
  },
  email_not_confirmed: {
    kind: 'unauthenticated',
    reason: 'emailNotConfirmed',
    message: 'Your email is not verified yet. Enter the code we sent you to finish signing up.',
  },
  // Supabase uses the one code for a wrong code and an expired one, so the
  // message has to cover both rather than guess which.
  otp_expired: {
    kind: 'validation',
    reason: 'codeInvalidOrExpired',
    field: 'code',
    message: 'That code is wrong or has expired. Check it, or send a new one.',
  },
  weak_password: {
    kind: 'validation',
    reason: 'weakPassword',
    field: 'password',
    message: 'That password is too weak. Choose a longer or less common one.',
  },
  same_password: {
    kind: 'validation',
    field: 'password',
    message: 'Choose a password different from your current one.',
  },
  email_address_invalid: {
    kind: 'validation',
    field: 'email',
    message: 'That email address cannot be used. Check it and try again.',
  },
  // With "Confirm email" on, Supabase normally answers a sign-up for a taken
  // address as if it succeeded, so as not to reveal who is registered. These
  // codes are the cases where it does not; the wording stays non-committal.
  user_already_exists: {
    kind: 'validation',
    field: 'email',
    message: 'An account could not be created with that email. If you already have one, sign in.',
  },
  email_exists: {
    kind: 'validation',
    field: 'email',
    message: 'An account could not be created with that email. If you already have one, sign in.',
  },
  over_email_send_rate_limit: {
    kind: 'rateLimited',
    reason: 'rateLimited',
    message: 'Too many emails have been requested. Wait a moment before asking for another.',
  },
  over_request_rate_limit: {
    kind: 'rateLimited',
    reason: 'rateLimited',
    message: 'Too many attempts. Wait a moment and try again.',
  },
  signup_disabled: {
    kind: 'forbidden',
    message: 'New accounts cannot be created right now.',
  },
  email_provider_disabled: {
    kind: 'forbidden',
    message: 'Signing in with email is not available right now.',
  },
  session_not_found: {
    kind: 'unauthenticated',
    reason: 'sessionExpired',
    message: 'Your session has ended. Sign in again.',
  },
  session_expired: {
    kind: 'unauthenticated',
    reason: 'sessionExpired',
    message: 'Your session has ended. Sign in again.',
  },
  refresh_token_not_found: {
    kind: 'unauthenticated',
    reason: 'sessionExpired',
    message: 'Your session has ended. Sign in again.',
  },
  refresh_token_already_used: {
    kind: 'unauthenticated',
    reason: 'sessionExpired',
    message: 'Your session has ended. Sign in again.',
  },
  bad_jwt: {
    kind: 'unauthenticated',
    reason: 'sessionExpired',
    message: 'Your session has ended. Sign in again.',
  },
};

const KIND_BY_STATUS: Record<number, ErrorKind> = {
  400: 'validation',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'notFound',
  409: 'validation',
  422: 'validation',
  429: 'rateLimited',
  500: 'server',
  502: 'server',
  503: 'server',
  504: 'network',
};

const KIND_BY_CODE: Record<string, ErrorKind> = {
  PGRST116: 'notFound',
  '42501': 'forbidden',
  '23505': 'validation',
  '23503': 'validation',
};

/** Messages safe to show a member. Anything else gets a generic line. */
const FRIENDLY: Record<ErrorKind, string> = {
  network: 'No connection. Check your internet and try again.',
  unauthenticated: 'Your session has expired. Sign in again.',
  forbidden: 'You do not have access to that.',
  notFound: 'We could not find that.',
  validation: 'Something about that is not right. Check it and try again.',
  server: 'Something went wrong at our end. Try again in a moment.',
  rateLimited: 'Too many attempts. Wait a moment and try again.',
  unknown: 'Something went wrong. Try again.',
};

/**
 * The wait Supabase states in a rate-limit refusal, e.g. "For security
 * purposes, you can only request this after 42 seconds."
 *
 * This is the one place a message is read for data, because the figure is not
 * sent anywhere else. When the wording has no number — the hourly email limit
 * says only "email rate limit exceeded" — the answer is undefined, not a guess.
 */
function readRetryAfterSeconds(message: string): number | undefined {
  const match = /after\s+(\d+)\s+seconds?/i.exec(message);
  if (!match?.[1]) return undefined;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

/**
 * What a weak-password refusal requires, in words a member can act on.
 *
 * Supabase says which character sets are required only by listing them in its
 * message ("…at least one character of each: abcdefghijklmnopqrstuvwxyz,
 * ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789"), so the sets are recognised there.
 * The `reasons` array says which rule failed; the message says what the rule is.
 */
function describeWeakPassword(message: string, reasons: unknown): string {
  const list = Array.isArray(reasons) ? reasons.map(String) : [];

  if (list.includes('pwned')) {
    return 'That password has appeared in a known data breach. Choose a different one.';
  }

  const needs: string[] = [];
  if (message.includes('abcdefghijklmnopqrstuvwxyz')) needs.push('a lowercase letter');
  if (message.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZ')) needs.push('an uppercase letter');
  if (message.includes('0123456789')) needs.push('a number');
  if (/[!@#$%^&*]{3,}/.test(message)) needs.push('a symbol');

  if (needs.length > 0) {
    const last = needs.pop();
    const joined = needs.length > 0 ? `${needs.join(', ')} and ${last}` : last;
    return `Your password needs at least ${joined}.`;
  }

  const length = /at least (\d+) characters/i.exec(message)?.[1];
  if (length) return `Your password needs at least ${length} characters.`;

  return 'That password is too weak. Choose a longer or less common one.';
}

export function classifySupabaseError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const raw = (error ?? {}) as SupabaseLikeError;
  const message = typeof raw.message === 'string' ? raw.message : '';

  // fetch() rejects rather than returning a status when the request never left
  // the device, so this has to be sniffed from the message. Supabase Auth wraps
  // the same failure in AuthRetryableFetchError, with status 0 when there was
  // no response at all.
  if (
    raw.name === 'AbortError' ||
    (raw.name === 'AuthRetryableFetchError' && (raw.status === 0 || raw.status === undefined)) ||
    /network request failed|fetch failed|timeout/i.test(message)
  ) {
    return new AppError('network', FRIENDLY.network, { cause: error });
  }

  // Supabase reports a failed confirmation email as a plain 500. Saying so is
  // worth the one message match: "something went wrong" sends the member off
  // to retry, when the fault is the project's email settings.
  if (typeof raw.status === 'number' && raw.status >= 500 && /sending.*email|smtp/i.test(message)) {
    return new AppError(
      'server',
      'We could not send the verification email. Try again in a few minutes.',
      { cause: error },
    );
  }

  const auth = raw.code ? AUTH_CODES[raw.code] : undefined;
  if (auth) {
    const { kind, message: standard, ...options } = auth;
    const shown =
      raw.code === 'weak_password' ? describeWeakPassword(message, raw.reasons) : standard;
    const retryAfterSeconds = kind === 'rateLimited' ? readRetryAfterSeconds(message) : undefined;
    return new AppError(kind, shown, { ...options, retryAfterSeconds, cause: error });
  }

  const byCode = raw.code ? KIND_BY_CODE[raw.code] : undefined;
  const byStatus = typeof raw.status === 'number' ? KIND_BY_STATUS[raw.status] : undefined;
  const kind: ErrorKind = byCode ?? byStatus ?? 'unknown';

  if (kind === 'rateLimited') {
    return new AppError(kind, FRIENDLY.rateLimited, {
      reason: 'rateLimited',
      retryAfterSeconds: readRetryAfterSeconds(message),
      cause: error,
    });
  }

  return new AppError(kind, FRIENDLY[kind], { cause: error });
}
