/**
 * An authenticated session, expressed in the app's own terms.
 *
 * Note what is absent: no access token, no refresh token, no provider name.
 * Tokens are an infrastructure concern — the Supabase client holds and refreshes
 * them, and nothing above the data layer should ever see one. Putting a token on
 * this type would invite a screen to read it, and that is how a token ends up in
 * a log or a crash report.
 */

export type UserId = string;

export type AuthenticatedUser = {
  id: UserId;
  email: string;
  /** Null until the member has completed onboarding and created a profile. */
  profileId: string | null;
};

export type Session = {
  user: AuthenticatedUser;
};

export type AuthState =
  /** The stored session has not been read yet. Show a splash, not a sign-in screen. */
  { status: 'restoring' } | { status: 'signedOut' } | { status: 'signedIn'; session: Session };
