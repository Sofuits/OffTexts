import type { LogContext, Logger } from './Logger';

/**
 * Sentry integration point — NOT wired up.
 *
 * Error reporting is out of scope for this stage, but the seam is here so that
 * turning it on is a dependency and an implementation rather than an
 * architectural change. Nothing above `infrastructure` mentions Sentry, and
 * nothing will need to.
 *
 * To enable:
 *
 *   1. npx expo install @sentry/react-native
 *   2. Put the DSN in .env as EXPO_PUBLIC_SENTRY_DSN (a DSN is public by
 *      design — it can only submit events, not read them).
 *   3. Fill in the bodies below, and delegate to `fallback` for anything Sentry
 *      does not handle.
 *   4. In `src/app/di/container.ts`, build a SentryLogger when env.sentryDsn is
 *      set. That is the only line that changes.
 *
 * Two rules when implementing it. Never pass a token, password or full email
 * into `context` — crash reports are read by more people than you expect. And
 * scrub `AppError.cause`, which can carry a whole request object.
 */
export class SentryLogger implements Logger {
  /** False when no DSN was supplied; every call then falls through to `fallback`. */
  readonly isEnabled: boolean;

  constructor(
    dsn: string,
    /** Everything is also written here, so local debugging still works. */
    private readonly fallback: Logger,
  ) {
    this.isEnabled = dsn.length > 0;
    if (!this.isEnabled) {
      this.fallback.warn('SentryLogger built without a DSN; reporting is disabled.');
    }
    // Sentry.init({ dsn, environment: env.environment, tracesSampleRate: 0.2 })
  }

  debug(message: string, context?: LogContext): void {
    this.fallback.debug(message, context);
  }

  info(message: string, context?: LogContext): void {
    // Sentry.addBreadcrumb({ level: 'info', message, data: context })
    this.fallback.info(message, context);
  }

  warn(message: string, context?: LogContext): void {
    // Sentry.captureMessage(message, { level: 'warning', extra: context })
    this.fallback.warn(message, context);
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    // Sentry.captureException(error ?? new Error(message), { extra: context })
    this.fallback.error(message, error, context);
  }

  captureException(error: unknown, context?: LogContext): void {
    // Sentry.captureException(error, { extra: context })
    this.fallback.captureException(error, context);
  }

  setUser(user: { id: string; email?: string } | null): void {
    // Sentry.setUser(user)
    this.fallback.setUser(user);
  }
}
