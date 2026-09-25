import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Logger } from '@/infrastructure/logging';
import type { KeyValueStore } from '@/infrastructure/storage';
import type { Database } from './rows';

/**
 * THE ONLY FILE THAT IMPORTS THE SUPABASE SDK.
 *
 * A lint rule enforces it (`no-restricted-imports` in eslint.config.js). If you
 * find yourself wanting `supabase` in a screen, a hook or a use case, the answer
 * is a repository method — that boundary is the entire reason this codebase can
 * move to a NestJS or Go backend without rewriting the UI.
 *
 * Three settings deserve an explanation:
 *
 *   storage — Supabase persists the session through whatever store it is given.
 *     It is given SecureStore, so the refresh token sits in the OS keychain
 *     rather than in AsyncStorage, which is readable on a rooted device.
 *
 *   detectSessionInUrl: false — that is browser behaviour, reading a token out
 *     of the address bar after an OAuth redirect. There is no address bar in a
 *     native app; leaving it on throws.
 *
 *   autoRefreshToken — on, but it only runs while the app is in the foreground.
 *     `startAutoRefresh`/`stopAutoRefresh` must be driven by AppState, which
 *     `SupabaseAppStateBridge` does. Without that, a session can expire while
 *     the app is backgrounded and the first request after resuming fails.
 */

export type TypedSupabaseClient = SupabaseClient<Database>;

export type SupabaseClientConfig = {
  url: string;
  anonKey: string;
  storage: KeyValueStore;
  logger: Logger;
  /**
   * Which environment this client is talking to. Log detail only.
   *
   * Passed in rather than read from `@/shared/config`, because that module
   * imports `expo-constants` — and this file is imported by every Supabase
   * repository, which the admin web app reuses verbatim. One `import { env }`
   * here would drag Expo into a browser bundle and make the data layer
   * native-only. The composition root knows the environment; this file does
   * not need to.
   */
  environment?: string;
};

/**
 * Adapts our KeyValueStore to the shape Supabase wants. The two are nearly
 * identical, which is not a coincidence — the interface was written so that a
 * swap to MMKV or to an in-memory store in tests needs no adapter beyond this.
 */
const asSupabaseStorage = (store: KeyValueStore) => ({
  getItem: (key: string) => store.getItem(key),
  setItem: (key: string, value: string) => store.setItem(key, value),
  removeItem: (key: string) => store.removeItem(key),
});

export function createSupabaseClient(config: SupabaseClientConfig): TypedSupabaseClient {
  if (!config.url || !config.anonKey) {
    throw new Error(
      'createSupabaseClient called without a URL or anon key. Check env.hasSupabase before building it.',
    );
  }

  config.logger.info('Supabase client created', { environment: config.environment ?? 'unknown' });

  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      storage: asSupabaseStorage(config.storage),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-application-name': 'offtexts-mobile' },
    },
  });
}
