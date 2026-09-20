import type { AuthState, Session } from '@/domain/entities';
import type { Result } from './Result';

export type Credentials = { email: string; password: string };

/** Identity providers the app supports. Only Google today. */
export const OAUTH_PROVIDERS = ['google'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/**
 * Authentication, expressed without naming a provider.
 *
 * `observeAuthState` is a subscription rather than a one-off read because a
 * session can end without the app asking — a token refresh fails, the account
 * is deleted, the user signs out on another device. A poll would miss it.
 *
 * Note what this interface does NOT expose: tokens. See `Session` for why.
 */
export interface AuthRepository {
  /** The session at this instant. Null when signed out. */
  getSession(): Promise<Result<Session | null>>;

  /**
   * Calls back on every change, including once with the current state.
   * @returns A function that stops the subscription. Always call it on unmount.
   */
  observeAuthState(listener: (state: AuthState) => void): () => void;

  /**
   * Opens the provider's consent screen and completes the exchange.
   *
   * Resolves with a session on success. A member who dismisses the browser is
   * NOT an error — it is a `cancelled` result, because showing "sign-in failed"
   * to someone who deliberately backed out is wrong.
   */
  signInWithOAuth(provider: OAuthProvider): Promise<Result<Session | null>>;

  /**
   * Kept although the UI only offers Google.
   *
   * App Store review requires a demo account the reviewer can sign in with, and
   * handing Apple a working Google account is awkward and a security problem.
   * An email/password path that exists but is not advertised solves that, and
   * costs nothing since Supabase supports both at once.
   */
  signInWithPassword(credentials: Credentials): Promise<Result<Session>>;

  signUpWithPassword(credentials: Credentials): Promise<Result<Session | null>>;

  /** Emails a one-time link. Resolves when the mail is sent, not when it is clicked. */
  sendMagicLink(email: string): Promise<Result<void>>;

  signOut(): Promise<Result<void>>;
}
