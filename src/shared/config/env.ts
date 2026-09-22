import Constants from 'expo-constants';

/**
 * Typed environment configuration.
 *
 * Values come from `app.config.ts -> expo.extra`, which Expo fills from the
 * EXPO_PUBLIC_* variables at build time.
 *
 * EVERYTHING HERE SHIPS IN THE BUNDLE and is readable by anyone who downloads
 * the app. That is fine for the Supabase URL and anon key — the anon key is
 * designed to be public, and what protects the data is Row Level Security on
 * the database, not the secrecy of that key. It is NOT fine for a service-role
 * key, which bypasses RLS entirely. If a service-role key ever appears in a
 * `.env` for this app, treat it as a leaked credential and rotate it.
 */

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  environment?: string;
  devSkipAuth?: string | boolean;
  sentryDsn?: string;
  enableAnalytics?: string | boolean;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

const readString = (value: string | undefined): string =>
  typeof value === 'string' ? value.trim() : '';

const readBoolean = (value: string | boolean | undefined, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

export type AppEnvironment = 'development' | 'staging' | 'production';

const environment = (readString(extra.environment) || 'development') as AppEnvironment;

const supabaseUrl = readString(extra.supabaseUrl);
const supabaseAnonKey = readString(extra.supabaseAnonKey);

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  /**
   * False until both Supabase values are present.
   *
   * The composition root reads this and wires in-memory repositories instead,
   * so a developer can clone, `npm install`, `npm start` and have a working app
   * with no backend account at all. Nothing else in the codebase branches on it.
   */
  hasSupabase: supabaseUrl.length > 0 && supabaseAnonKey.length > 0,

  /**
   * Start the app already signed in, against in-memory data. Development only.
   *
   * It exists so the screens can be worked on before Google sign-in is
   * configured, and it is deliberately awkward in two ways.
   *
   * First, `environment === 'production'` disables it no matter what the
   * variable says, so a forgotten `.env` cannot ship an app that lets anyone
   * past the auth gate. A flag that can only be wrong in development is worth
   * having; one that can be wrong in production is a liability.
   *
   * Second, it forces the in-memory repositories even when Supabase is
   * configured. That is not a limitation, it is the only coherent behaviour:
   * every Row Level Security policy on the database requires an authenticated
   * caller, so a fake session against real Supabase returns zero rows from
   * every table and the app looks broken rather than empty. Fake session, fake
   * data — the two belong together.
   */
  devSkipAuth: environment !== 'production' && readBoolean(extra.devSkipAuth, false),

  sentryDsn: readString(extra.sentryDsn),
  environment,
  enableAnalytics: readBoolean(extra.enableAnalytics, false),
  isDevelopment: environment === 'development',
  isProduction: environment === 'production',
} as const;

export type Env = typeof env;
