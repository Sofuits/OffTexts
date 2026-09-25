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
 *   PGRST106  the schema is not exposed (Dashboard → API → Exposed schemas)
 *   PGRST205  the table or view is not in PostgREST's schema cache
 *
 * The last two mean the API surface is not wired up — a migration not applied,
 * a schema not exposed, a cache not reloaded. They are 'server': not the
 * member's fault, and a retry after the fix (or a cache reload) succeeds.
 */

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
  name?: string;
};

/** What the dev-only reporter is given: the raw error, before it is replaced. */
export type RawSupabaseError = {
  kind: ErrorKind;
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
};

let reportRaw: ((raw: RawSupabaseError) => void) | null = null;

/**
 * Development only: have every classified failure reported raw.
 *
 * Every error a member sees is one of the generic sentences below, with the
 * database's own message kept only in `AppError.cause` — which is right in
 * production, where that message names columns and constraints, and useless
 * on a device when an unmapped code collapses to "Something went wrong".
 *
 * A setter rather than a check of `env` here, because this file is imported by
 * `data/`, which also runs in the admin web app, and `@/shared/config` cannot
 * be bundled there. The composition root turns it on behind the same flag as
 * the demo sign-in, so a production build never reports anything. `null`
 * turns it off.
 */
export function reportRawSupabaseErrors(reporter: ((raw: RawSupabaseError) => void) | null): void {
  reportRaw = reporter;
}

function report(kind: ErrorKind, raw: SupabaseLikeError): void {
  if (!reportRaw) return;
  try {
    reportRaw({
      kind,
      code: raw.code,
      message: raw.message,
      details: raw.details,
      hint: raw.hint,
      status: raw.status,
    });
  } catch {
    // Logging must never be the reason error handling fails.
  }
}

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
  PGRST106: 'server',
  PGRST205: 'server',
};

/** Messages safe to show a member. Anything else gets a generic line. */
const FRIENDLY: Record<ErrorKind, string> = {
  network: 'No connection. Check your internet and try again.',
  unauthenticated: 'Your session has expired. Sign in again.',
  forbidden: 'You do not have access to that.',
  notFound: 'We could not find that.',
  validation: 'Something about that is not right. Check it and try again.',
  server: 'Something went wrong at our end. Try again in a moment.',
  // No "try again": `unknown` is not retryable, so no Retry button is shown,
  // and an instruction with nothing to tap is worse than none.
  unknown: 'Something went wrong that we did not expect.',
};

export function classifySupabaseError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const raw = (error ?? {}) as SupabaseLikeError;
  const message = typeof raw.message === 'string' ? raw.message : '';

  // fetch() rejects rather than returning a status when the request never left
  // the device, so this has to be sniffed from the message.
  if (raw.name === 'AbortError' || /network request failed|fetch failed|timeout/i.test(message)) {
    report('network', raw);
    return new AppError('network', FRIENDLY.network, { cause: error });
  }

  const byCode = raw.code ? KIND_BY_CODE[raw.code] : undefined;
  const byStatus = typeof raw.status === 'number' ? KIND_BY_STATUS[raw.status] : undefined;
  const kind: ErrorKind = byCode ?? byStatus ?? 'unknown';
  report(kind, raw);

  // Auth messages are written for members and are worth keeping verbatim
  // ("Invalid login credentials"). Database messages are not — they leak column
  // and constraint names.
  const isAuthMessage = /credential|password|email|otp|token/i.test(message);
  const shown = kind === 'validation' && isAuthMessage && message ? message : FRIENDLY[kind];

  return new AppError(kind, shown, { cause: error });
}
