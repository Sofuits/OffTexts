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
  enableGoogleAuth?: string | boolean;
  sentryDsn?: string;
  enableAnalytics?: string | boolean;
  demoEmail?: string;
  demoPassword?: string;
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

const hasSupabase = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

/**
 * Credentials for a one-tap demo sign-in. Non-production only.
 *
 * READ THIS BEFORE SETTING THEM.
 *
 * Everything on `extra` ships inside the bundle. A password here is readable
 * by anyone who downloads the app, so it may only ever be a **throwaway test
 * account created for this purpose** — never a real member's, never an
 * account with staff access, and never one whose password is used anywhere
 * else. Treat the value as public from the moment it is written down.
 *
 * It exists because sign-in is somebody else's piece of work and the rest of
 * the app is behind it. Everything past the auth gate needs a real session —
 * every Row Level Security policy on the database requires an authenticated
 * caller — so without this, reviewing the screens means creating an account by
 * hand first.
 *
 * `DEV_SKIP_AUTH` is NOT the same thing and is not a substitute. It forces the
 * in-memory repositories, so nothing is read from or written to Supabase and
 * no policy is ever exercised. This signs in properly: real session, real RLS,
 * real rows. That is the point of it.
 */
const demoEmail = readString(extra.demoEmail);
const demoPassword = readString(extra.demoPassword);

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
  hasSupabase,

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

  /**
   * Whether to offer "Continue with Google".
   *
   * Defaults to FALSE, and that default is the point. Google sign-in needs an
   * OAuth client in Google Cloud and the provider switched on in the Supabase
   * dashboard; until both exist, tapping the button produces
   * "Unsupported provider: provider is not enabled" — an error the member can
   * do nothing about, on the first screen of the app.
   *
   * A button that always fails is worse than no button. This flag means the
   * option appears the day it works and not a day earlier, without a code
   * change, and it means nobody has to remember to delete a placeholder.
   */
  enableGoogleAuth: readBoolean(extra.enableGoogleAuth, false),

  demoEmail,
  demoPassword,
  /**
   * Whether to offer the demo button.
   *
   * Three conditions, all of them load-bearing. `environment !== 'production'`
   * is the one that matters most: a forgotten `.env` must not be able to ship
   * an app with a sign-in shortcut on its first screen, and a flag that can
   * only be wrong in development is worth having where one that can be wrong in
   * production is a liability. Supabase has to be configured because the whole
   * point is a real session. And both halves of the credential have to be
   * present, because half of one is a button that fails on tap.
   */
  hasDemoSignIn:
    environment !== 'production' && hasSupabase && demoEmail.length > 0 && demoPassword.length > 0,

  sentryDsn: readString(extra.sentryDsn),
  environment,
  enableAnalytics: readBoolean(extra.enableAnalytics, false),
  isDevelopment: environment === 'development',
  isProduction: environment === 'production',
} as const;

export type Env = typeof env;
