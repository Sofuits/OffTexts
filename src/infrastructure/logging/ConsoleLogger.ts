import { env } from '@/shared/config';
import type { LogContext, Logger } from './Logger';

/**
 * Development logger.
 *
 * In production it drops debug and info and keeps warnings and errors, so a
 * release build stays quiet without the call sites having to care.
 */
export class ConsoleLogger implements Logger {
  constructor(private readonly verbose: boolean = env.isDevelopment) {}

  debug(message: string, context?: LogContext): void {
    if (!this.verbose) return;
    // eslint-disable-next-line no-console
    console.log(`[debug] ${message}`, context ?? '');
  }

  info(message: string, context?: LogContext): void {
    if (!this.verbose) return;
    // eslint-disable-next-line no-console
    console.log(`[info] ${message}`, context ?? '');
  }

  warn(message: string, context?: LogContext): void {
    console.warn(`[warn] ${message}`, context ?? '');
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(`[error] ${message}`, error ?? '', context ?? '');
  }

  captureException(error: unknown, context?: LogContext): void {
    console.error('[exception]', error, context ?? '');
  }

  setUser(): void {
    // Nothing to attach to in development.
  }
}
