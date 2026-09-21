import type { AuthState, Session } from '@/domain/entities';
import type { Result } from './Result';

export type Credentials = { email: string; password: string };

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

  signInWithPassword(credentials: Credentials): Promise<Result<Session>>;

  signUpWithPassword(credentials: Credentials): Promise<Result<Session | null>>;

  /** Emails a one-time link. Resolves when the mail is sent, not when it is clicked. */
  sendMagicLink(email: string): Promise<Result<void>>;

  signOut(): Promise<Result<void>>;
}
