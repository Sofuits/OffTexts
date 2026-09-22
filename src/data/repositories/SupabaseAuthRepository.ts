import type { AuthState, Session } from '@/domain/entities';
import {
  attempt,
  failure,
  success,
  AppError,
  type AuthRepository,
  type Credentials,
  type OAuthProvider,
  type Result,
} from '@/domain/repositories';
import type { Logger } from '@/infrastructure/logging';
import { classifySupabaseError } from '@/infrastructure/supabase/supabaseErrors';
import type { OAuthOutcome } from '@/infrastructure/supabase/oauthFlow';
import type { TypedSupabaseClient } from '@/infrastructure/supabase/supabaseClient';

/**
 * Opens the provider's sign-in page and reports what the member did.
 *
 * Injected rather than imported, because the only implementation opens a system
 * browser through `expo-web-browser` — a native module. Importing it here would
 * make this file, and therefore the whole data layer, impossible to load in a
 * browser, and the admin web app reuses that layer verbatim.
 *
 * It is the same argument as the repositories themselves, one level down: name
 * what you need, let the composition root decide how.
 */
export type OAuthFlow = (
  client: TypedSupabaseClient,
  provider: OAuthProvider,
) => Promise<OAuthOutcome>;

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
    /** Absent on platforms with no browser flow — the admin web app, for one. */
    private readonly oauthFlow?: OAuthFlow,
    /**
     * Where a password reset email should send the member back to.
     *
     * A string, not a link builder: on the phone it is a deep link built by
     * expo-linking, on the admin portal it is an ordinary https URL, and this
     * file has no business knowing which. Whatever is passed must also be
     * listed under Authentication → URL Configuration → Redirect URLs, or
     * Supabase silently substitutes the site URL and the member lands on a web
     * page instead of in the app.
     */
    private readonly passwordResetRedirect?: string,
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

  /**
   * Google sign-in.
   *
   * Resolves with `null` when the member backed out of the browser. That is a
   * deliberate third outcome alongside success and failure: showing "sign-in
   * failed" to someone who pressed cancel is wrong, and collapsing it into an
   * error would make that unavoidable at the call site.
   *
   * The session is not read back here. `setSession` inside the flow fires
   * `onAuthStateChange`, which `observeAuthState` is already listening to, so
   * the app updates through the same path as a restored session or a sign-out
   * on another device — one code path rather than two.
   */
  async signInWithOAuth(provider: OAuthProvider): Promise<Result<Session | null>> {
    const flow = this.oauthFlow;
    if (!flow) {
      return failure(
        new AppError(
          'unknown',
          'Signing in with a provider is not available here. Use an email address and password.',
        ),
      );
    }

    const result = await attempt(async () => {
      const outcome = await flow(this.client, provider);
      if (outcome.status === 'cancelled') {
        this.logger.info('OAuth sign-in cancelled by the member', { provider });
        return null;
      }

      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;
      return this.toSession(data.session);
    }, classifySupabaseError);

    return result;
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

  /**
   * `redirectTo` is where the emailed link lands. It has to be one of the
   * project's allowed redirect URLs or Supabase silently sends the member to
   * the site URL instead, which on a phone is a web page rather than the app.
   *
   * Injected rather than read from config so that this class still knows
   * nothing about expo-linking — which is also what lets the admin portal
   * construct it with a plain https URL and reuse this file unchanged.
   */
  async sendPasswordReset(email: string): Promise<Result<void>> {
    return attempt(async () => {
      const { error } = await this.client.auth.resetPasswordForEmail(
        email,
        this.passwordResetRedirect ? { redirectTo: this.passwordResetRedirect } : undefined,
      );
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
