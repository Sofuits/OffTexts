/**
 * Logging, behind an interface.
 *
 * Nothing in the app calls `console.log` directly. That matters for two
 * reasons: console output is invisible in a released build, so a bug a real
 * user hits leaves no trace; and a console call cannot be routed anywhere else
 * later without editing every site that makes one.
 *
 * Wiring Sentry means implementing this interface once. See SentryLogger below.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured detail attached to a log line. Never put a token or a password here. */
export type LogContext = Record<string, unknown>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  /** An error that was handled. An unhandled one goes through `captureException`. */
  error(message: string, error?: unknown, context?: LogContext): void;
  /** Reports a caught exception to the error tracker. */
  captureException(error: unknown, context?: LogContext): void;
  /** Ties subsequent reports to a user. Pass null on sign-out. */
  setUser(user: { id: string; email?: string } | null): void;
}
