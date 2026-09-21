import type { AuthState, Session } from '@/domain/entities';
import {
  attempt,
  failure,
  success,
  AppError,
  type AuthRepository,
  type Credentials,
  type Result,
} from '@/domain/repositories';
import type { Logger } from '@/infrastructure/logging';
import { classifySupabaseError, type TypedSupabaseClient } from '@/infrastructure/supabase';

/**
 * Authentication on Supabase.
 *
 * The Supabase session is translated into our own `Session` on the way out, and
 * the access token is dropped in the process. Nothing above this file can leak
 * a token into a log, a crash report or a navigation param, because nothing
 * above this file can see one.
 */
export class SupabaseAuthRepository implements AuthRepository {
  constructor(
    private readonly client: TypedSupabaseClient,
    private readonly logger: Logger,
  ) {}

  /**
   * `profileId` is deliberately null here.
   *
   * Resolving it means a second query into `profiles`, and this runs on every
   * auth event including token refresh. Screens that need the profile ask the
   * ProfileRepository, which is cached; doing it here would be an extra round
   * trip several times an hour for something usually already in hand.
   */
  private toSession(raw: { user: { id: string; email?: string } } | null): Session | null {
    if (!raw?.user) return null;
    return {
      user: {
        id: raw.user.id,
        email: raw.user.email ?? '',
        profileId: null,
      },
    };
  }

  async getSession(): Promise<Result<Session | null>> {
    return attempt(async () => {
      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;
      return this.toSession(data.session);
    }, classifySupabaseError);
  }

  observeAuthState(listener: (state: AuthState) => void): () => void {
    listener({ status: 'restoring' });

    // Fires once with the restored session, then on every later change.
    const { data } = this.client.auth.onAuthStateChange((event, rawSession) => {
      this.logger.debug('Supabase auth event', { event });
      const session = this.toSession(rawSession);
      listener(session ? { status: 'signedIn', session } : { status: 'signedOut' });
    });

    return () => data.subscription.unsubscribe();
  }

  async signInWithPassword(credentials: Credentials): Promise<Result<Session>> {
    const result = await attempt(async () => {
      const { data, error } = await this.client.auth.signInWithPassword(credentials);
      if (error) throw error;
      return this.toSession(data.session);
    }, classifySupabaseError);

    if (!result.ok) return result;
    if (!result.value) {
      return failure(new AppError('unknown', 'Sign-in succeeded but no session came back.'));
    }
    return success(result.value);
  }

  /**
   * Returns a null session when email confirmation is on — the account exists
   * but is not usable until the link is clicked. The caller must handle that
   * rather than assuming a session, which is why the return type says so.
   */
  async signUpWithPassword(credentials: Credentials): Promise<Result<Session | null>> {
    return attempt(async () => {
      const { data, error } = await this.client.auth.signUp(credentials);
      if (error) throw error;
      return this.toSession(data.session);
    }, classifySupabaseError);
  }

  async sendMagicLink(email: string): Promise<Result<void>> {
    return attempt(async () => {
      const { error } = await this.client.auth.signInWithOtp({ email });
      if (error) throw error;
    }, classifySupabaseError);
  }

  async signOut(): Promise<Result<void>> {
    return attempt(async () => {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
    }, classifySupabaseError);
  }
}
