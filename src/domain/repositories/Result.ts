/**
 * The return type of every repository method.
 *
 * WHY NOT just throw: a thrown error is invisible to the type system. A caller
 * can forget to catch it and TypeScript will not say a word. `Result` makes the
 * failure part of the signature, so handling it is checked at compile time.
 *
 * It also gives every layer one error vocabulary. A screen should not have to
 * know whether a failure came from Postgres, from a fetch timeout or from a
 * validation rule — it needs to know whether to retry, to ask the user to sign
 * in again, or to show a message.
 */

export const ERROR_KINDS = [
  /** No connectivity, or the request timed out. Retrying may work. */
  'network',
  /** Not signed in, or the session expired. Send the user to sign-in. */
  'unauthenticated',
  /** Signed in, but not allowed. Retrying will not help. */
  'forbidden',
  /** The thing asked for does not exist. */
  'notFound',
  /** The input was rejected. `field` says which one. */
  'validation',
  /** The server broke. Not the caller's fault. */
  'server',
  /**
   * The server refused because too many requests were made. Not retryable
   * straight away: trying again immediately is refused again, and on the email
   * endpoints it can use up the project's hourly sending allowance.
   */
  'rateLimited',
  /** Anything unclassified. Treated as unrecoverable. */
  'unknown',
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

/**
 * Why an authentication call failed, when the screen has to react to the
 * specific reason rather than only show the message.
 *
 * `emailNotConfirmed` is the clearest case: the sign-in screen must offer the
 * way to verify, which it can only do if it can tell that failure apart from a
 * wrong password without reading the message text.
 */
export const AUTH_FAILURE_REASONS = [
  'invalidCredentials',
  'emailNotConfirmed',
  'codeInvalidOrExpired',
  'weakPassword',
  'rateLimited',
  'sessionExpired',
] as const;

export type AuthFailureReason = (typeof AUTH_FAILURE_REASONS)[number];

export type AppErrorOptions = {
  field?: string;
  cause?: unknown;
  reason?: AuthFailureReason;
  retryAfterSeconds?: number;
};

export class AppError extends Error {
  readonly kind: ErrorKind;
  /** For `validation`: which input was rejected. */
  readonly field?: string;
  /** For authentication failures the UI handles specifically. */
  readonly reason?: AuthFailureReason;
  /**
   * For `rateLimited`: how long the server said to wait, when it said.
   * Absent when the server gave no figure — never filled in with a guess.
   */
  readonly retryAfterSeconds?: number;
  /**
   * The original error, kept for logging. Never shown to a user.
   * `override` because ES2022 added `cause` to Error itself.
   */
  override readonly cause?: unknown;

  constructor(kind: ErrorKind, message: string, options?: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.field = options?.field;
    this.reason = options?.reason;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.cause = options?.cause;
  }

  /** True when trying the same call again might succeed. */
  get isRetryable(): boolean {
    return this.kind === 'network' || this.kind === 'server';
  }
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export const success = <T>(value: T): Result<T> => ({ ok: true, value });

export const failure = <T = never>(error: AppError): Result<T> => ({ ok: false, error });

/**
 * Runs an async function and converts a thrown error into a failed Result.
 *
 * Data sources use this at their boundary so that no exception escapes the data
 * layer. `classify` turns a library-specific error into an AppError; each data
 * source knows how to read its own client's errors.
 */
export async function attempt<T>(
  operation: () => Promise<T>,
  classify: (error: unknown) => AppError,
): Promise<Result<T>> {
  try {
    return success(await operation());
  } catch (error) {
    return failure(classify(error));
  }
}

/** Throws on failure. For React Query, whose retry and error states want a throw. */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw result.error;
}
