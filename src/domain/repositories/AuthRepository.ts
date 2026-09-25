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

  /**
   * Confirms a new account with the code emailed at sign-up.
   *
   * Resolves with a session: a correct code both verifies the address and
   * signs the member in, so they are not asked for the password they typed a
   * minute ago.
   */
  verifySignUpCode(email: string, code: string): Promise<Result<Session>>;

  /**
   * Emails the sign-up code again.
   *
   * Rate limited by the server. A refusal comes back as a `rateLimited` error,
   * carrying `retryAfterSeconds` when the server said how long to wait.
   */
  resendSignUpCode(email: string): Promise<Result<void>>;

  /**
   * Not offered by the app. Kept because the interface predates the decision
   * and removing it is a separate change.
   */
  sendMagicLink(email: string): Promise<Result<void>>;

  /**
   * Emails a password reset link.
   *
   * Succeeds whether or not an account exists at that address. That is not an
   * oversight to be tidied up later: reporting "no such account" would turn
   * this into a way to find out who is a member, which for a dating app is a
   * disclosure in itself.
   */
  sendPasswordReset(email: string): Promise<Result<void>>;

  /**
   * Starts a session from the link in a password reset email.
   *
   * `link` is the whole URL the app was opened with. On success the member is
   * signed in, and the caller must send them to choose a new password before
   * anything else — the session exists only so that they can.
   */
  beginPasswordRecovery(link: string): Promise<Result<void>>;

  /** Sets a new password for the signed-in member. */
  updatePassword(password: string): Promise<Result<void>>;

  /**
   * Ends EVERY session the member has — this device and all others.
   *
   * Other devices find out when they next refresh their token; until then an
   * access token they already hold keeps working until it expires. The local
   * session is removed even when the server cannot be reached.
   */
  signOut(): Promise<Result<void>>;
}
