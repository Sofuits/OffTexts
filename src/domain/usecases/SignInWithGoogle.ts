import type { Session } from '@/domain/entities';
import {
  AppError,
  failure,
  success,
  type AuthRepository,
  type Result,
} from '@/domain/repositories';

/**
 * The outcome of a sign-in attempt, as the UI needs to see it.
 *
 * Three states, not two. A member who dismisses the browser has not failed at
 * anything, and an app that says "sign-in failed" to someone who pressed
 * cancel reads as broken. Making cancellation a first-class outcome means the
 * screen cannot accidentally treat it as an error.
 */
export type SignInOutcome = { status: 'signedIn'; session: Session } | { status: 'cancelled' };

/**
 * Signs a member in with Google.
 *
 * Thin, but not a pass-through: it converts "no session" into a named
 * cancellation, which is a product decision about how the app behaves, not a
 * detail of how Supabase reports things.
 */
export class SignInWithGoogle {
  constructor(private readonly auth: AuthRepository) {}

  async execute(): Promise<Result<SignInOutcome>> {
    const result = await this.auth.signInWithOAuth('google');
    if (!result.ok) return failure(result.error);

    if (!result.value) return success({ status: 'cancelled' });
    return success({ status: 'signedIn', session: result.value });
  }
}

/**
 * Signs the member out.
 *
 * A use case rather than a direct repository call because signing out is more
 * than ending a session: cached data belongs to the member who was signed in,
 * and leaving it behind means the next person to sign in on this phone sees
 * someone else's profile for a moment before the refetch lands. The caller is
 * given a hook to clear it.
 */
export class SignOut {
  constructor(
    private readonly auth: AuthRepository,
    /** Clears local caches. Runs even if the network sign-out fails. */
    private readonly clearLocalData: () => Promise<void>,
  ) {}

  async execute(): Promise<Result<void>> {
    const result = await this.auth.signOut();

    // Deliberately unconditional. If the network call failed, the member still
    // pressed sign out, and their data must not stay on the device.
    await this.clearLocalData();

    if (!result.ok) {
      // The local state is clean either way, so this is reported rather than
      // fatal — the auth subscription has already moved to signedOut.
      return failure(
        new AppError('network', 'Signed out on this device, but the server was not reachable.', {
          cause: result.error,
        }),
      );
    }

    return success(undefined);
  }
}
