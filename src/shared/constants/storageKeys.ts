/**
 * Every key used in persistent storage, in one place.
 *
 * Namespaced with an app prefix so our keys cannot collide with anything a
 * third-party SDK writes into the same store. Declaring them here is also what
 * makes a sign-out able to clear everything — SecureStore has no "clear all",
 * so the only way to remove the member's data is to know the list.
 */
export const STORAGE_KEYS = {
  /** Supabase writes the session here. It holds a refresh token: SecureStore only. */
  authSession: '@offtexts/auth-session',
  onboardingComplete: '@offtexts/onboarding-complete',
  themePreference: '@offtexts/theme-preference',
  cachedProfile: '@offtexts/cached-profile',
  cachedMeets: '@offtexts/cached-meets',
  queryCache: '@offtexts/query-cache',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Cleared on sign-out. The theme preference deliberately survives. */
export const KEYS_TO_CLEAR_ON_SIGN_OUT: StorageKey[] = [
  STORAGE_KEYS.authSession,
  STORAGE_KEYS.cachedProfile,
  STORAGE_KEYS.cachedMeets,
  STORAGE_KEYS.queryCache,
];
