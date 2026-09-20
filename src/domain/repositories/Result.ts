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
  /** Anything unclassified. Treated as unrecoverable. */
  'unknown',
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

export class AppError extends Error {
  readonly kind: ErrorKind;
  /** For `validation`: which input was rejected. */
  readonly field?: string;
  /**
   * The original error, kept for logging. Never shown to a user.
   * `override` because ES2022 added `cause` to Error itself.
   */
  override readonly cause?: unknown;

  constructor(kind: ErrorKind, message: string, options?: { field?: string; cause?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.field = options?.field;
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
