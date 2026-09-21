import { AppError, type ErrorKind } from '@/domain/repositories';

/**
 * Turns whatever Supabase threw into an AppError.
 *
 * This is the translation boundary. Above it nobody knows what a PostgREST
 * error code is; below it, that is all there is. Getting it wrong is costly in
 * a specific way: classify an expired session as 'server' and the app retries
 * forever instead of sending the member to sign in.
 *
 * Codes come from PostgREST and Postgres:
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
};

const KIND_BY_STATUS: Record<number, ErrorKind> = {
  400: 'validation',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'notFound',
  409: 'validation',
  422: 'validation',
  429: 'server',
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
  unknown: 'Something went wrong. Try again.',
};

export function classifySupabaseError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const raw = (error ?? {}) as SupabaseLikeError;
  const message = typeof raw.message === 'string' ? raw.message : '';

  // fetch() rejects rather than returning a status when the request never left
  // the device, so this has to be sniffed from the message.
  if (raw.name === 'AbortError' || /network request failed|fetch failed|timeout/i.test(message)) {
    return new AppError('network', FRIENDLY.network, { cause: error });
  }

  const byCode = raw.code ? KIND_BY_CODE[raw.code] : undefined;
  const byStatus = typeof raw.status === 'number' ? KIND_BY_STATUS[raw.status] : undefined;
  const kind: ErrorKind = byCode ?? byStatus ?? 'unknown';

  // Auth messages are written for members and are worth keeping verbatim
  // ("Invalid login credentials"). Database messages are not — they leak column
  // and constraint names.
  const isAuthMessage = /credential|password|email|otp|token/i.test(message);
  const shown = kind === 'validation' && isAuthMessage && message ? message : FRIENDLY[kind];

  return new AppError(kind, shown, { cause: error });
}
