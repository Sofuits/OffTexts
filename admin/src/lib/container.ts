import { SupabaseAdminRepository, SupabaseAuthRepository } from '@/data/repositories';
import type { AdminRepository, AuthRepository } from '@/domain/repositories';
import { SignIn } from '@/domain/usecases';
import type { KeyValueStore } from '@/infrastructure/storage';
import type { LogContext, Logger } from '@/infrastructure/logging';
import {
  createSupabaseClient,
  type TypedSupabaseClient,
} from '@/infrastructure/supabase/supabaseClient';

/**
 * The admin portal's composition root.
 *
 * Deliberately a separate file from the app's `src/app/di/container.ts`, and
 * deliberately much smaller. A composition root is the one place a program
 * says which concrete thing satisfies which interface, and those answers differ
 * between a phone and a browser: the keychain becomes localStorage, NetInfo
 * becomes nothing at all, and there is no OAuth browser flow to hand over.
 *
 * Everything below that line — the repositories, the use cases, the entities —
 * is the same code the phone runs.
 */

/**
 * `KeyValueStore` on top of localStorage.
 *
 * The interface is async because a phone's keychain is; localStorage is not, so
 * these resolve immediately. Every access is wrapped because localStorage
 * throws rather than returning null in a private window or with site data
 * blocked, and a thrown storage error during client construction would take
 * down the whole page before anything rendered.
 */
class BrowserStore implements KeyValueStore {
  async getItem(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Nothing useful to do. A session that cannot be persisted still works
      // for this tab; the member simply signs in again tomorrow.
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* see setItem */
    }
  }

  async clear(): Promise<void> {
    try {
      window.localStorage.clear();
    } catch {
      /* see setItem */
    }
  }
}

/** Console logging. No Sentry here yet; the portal has a handful of users. */
class ConsoleLogger implements Logger {
  debug(message: string, context?: LogContext): void {
    if (import.meta.env.DEV) console.debug('[debug]', message, context ?? '');
  }
  info(message: string, context?: LogContext): void {
    console.info('[info]', message, context ?? '');
  }
  warn(message: string, context?: LogContext): void {
    console.warn('[warn]', message, context ?? '');
  }
  error(message: string, error?: unknown, context?: LogContext): void {
    console.error('[error]', message, error ?? '', context ?? '');
  }
  captureException(error: unknown, context?: LogContext): void {
    console.error('[exception]', error, context ?? '');
  }
  setUser(): void {
    // No error tracker to tell.
  }
}

export type AdminContainer = {
  client: TypedSupabaseClient;
  repositories: { auth: AuthRepository; admin: AdminRepository };
  useCases: { signIn: SignIn };
  logger: Logger;
};

export class MissingConfigError extends Error {}

export function createAdminContainer(): AdminContainer {
  const url = import.meta.env.VITE_SUPABASE_URL ?? '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

  if (!url || !anonKey) {
    // Thrown rather than defaulted. The phone app falls back to in-memory
    // repositories when unconfigured, which is right there — a developer gets
    // a working app. Here it would be wrong: a staff portal showing invented
    // members is worse than one that refuses to start.
    throw new MissingConfigError(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required. Copy admin/.env.example to admin/.env.',
    );
  }

  const logger = new ConsoleLogger();

  const client = createSupabaseClient({
    url,
    anonKey,
    storage: new BrowserStore(),
    logger,
    environment: import.meta.env.MODE,
  });

  // No OAuth flow passed. Staff sign in with an email and a password, and
  // `SupabaseAuthRepository` returns a clear message rather than crashing if
  // anything ever calls signInWithOAuth here.
  const auth = new SupabaseAuthRepository(client, logger);

  return {
    client,
    repositories: { auth, admin: new SupabaseAdminRepository(client) },
    useCases: { signIn: new SignIn(auth) },
    logger,
  };
}
