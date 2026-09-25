import type { Session } from '@/domain/entities';
import {
  AppError,
  type AuthRepository,
  type Credentials,
  failure,
  type Result,
} from '@/domain/repositories';
import { isValidEmail } from '@/shared/validation';
import { type PasswordRequirement, validateNewPassword } from './passwordRules';

export type SignUpInput = Credentials & {
  /**
   * Required, not optional.
   *
   * A typo in a password you cannot see locks you out of an account you have
   * just created, and the recovery path for that is an email you may not be
   * able to receive if the typo was in the address. Two fields is the cheapest
   * insurance in the product.
   */
  confirmPassword: string;
};

/**
 * The result of a successful sign-up.
 *
 * `session` is null when the project has email confirmation switched on: the
 * account exists but cannot be used until the link is clicked. That is not an
 * error and it is not a session, so it gets its own shape rather than being
 * squeezed into either — the screen has to say something quite different in
 * each case, and a boolean buried in a nullable session is how it ends up
 * saying the wrong one.
 */
export type SignUpOutcome =
  { status: 'signedIn'; session: Session } | { status: 'confirmationRequired'; email: string };

/**
 * Creates an account with an email and a password.
 *
 * Every check here is repeated on the server — Supabase enforces its own
 * minimum, and the database rejects a profile that breaks its constraints.
 * These run first because a round trip on a bad Indian mobile connection is
 * several seconds of a member watching a spinner to be told something the app
 * already knew.
 */
export class SignUp {
  constructor(
    private readonly auth: AuthRepository,
    /** The project's Supabase "Password requirements" setting. */
    private readonly passwordRequirement: PasswordRequirement = null,
  ) {}

  async execute(input: SignUpInput): Promise<Result<SignUpOutcome>> {
    const email = input.email.trim().toLowerCase();

    if (!isValidEmail(email)) {
      return failure(
        new AppError('validation', 'Enter an email like name@example.com.', { field: 'email' }),
      );
    }

    const problem = validateNewPassword(
      input.password,
      input.confirmPassword,
      this.passwordRequirement,
    );
    if (problem) return failure(problem);

    const result = await this.auth.signUpWithPassword({ email, password: input.password });
    if (!result.ok) return result;

    return {
      ok: true,
      value: result.value
        ? { status: 'signedIn', session: result.value }
        : { status: 'confirmationRequired', email },
    };
  }
}
