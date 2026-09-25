import type { Session } from '@/domain/entities';
import {
  AppError,
  type AuthRepository,
  type Credentials,
  failure,
  type Result,
} from '@/domain/repositories';
import { isValidEmail } from '@/shared/validation';

/**
 * The shortest password the product will accept.
 *
 * Eight, not six. Supabase's own default is six and that is too short to be
 * worth having — but the more important half of this decision is what is NOT
 * here: no required digit, no required symbol, no required capital.
 *
 * Forced composition rules are counterproductive. They push people towards
 * `Password1!` and towards writing the result down, and they make a long
 * memorable passphrase illegal while permitting a short ugly one. Length is
 * the property that actually costs an attacker something.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * bcrypt, which Supabase uses, silently truncates beyond 72 BYTES. A member
 * whose password is longer would find that only the first 72 bytes mattered,
 * and — worse — that pasting a slightly different long password still worked.
 * Rejecting it up front is honest; truncating it quietly is not.
 */
export const MAX_PASSWORD_LENGTH = 72;

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
  constructor(private readonly auth: AuthRepository) {}

  async execute(input: SignUpInput): Promise<Result<SignUpOutcome>> {
    const email = input.email.trim().toLowerCase();

    if (!isValidEmail(email)) {
      return failure(
        new AppError('validation', 'Enter an email like name@example.com.', { field: 'email' }),
      );
    }

    if (input.password.length < MIN_PASSWORD_LENGTH) {
      return failure(
        new AppError(
          'validation',
          `Use at least ${MIN_PASSWORD_LENGTH} characters. A few words you will remember beats a short jumble you will not.`,
          { field: 'password' },
        ),
      );
    }

    // Byte length, not character length: an emoji is four bytes and a member
    // using them would hit bcrypt's limit long before 72 characters.
    if (new TextEncoder().encode(input.password).length > MAX_PASSWORD_LENGTH) {
      return failure(
        new AppError(
          'validation',
          `Passwords cannot be longer than ${MAX_PASSWORD_LENGTH} bytes.`,
          {
            field: 'password',
          },
        ),
      );
    }

    if (input.password !== input.confirmPassword) {
      return failure(
        new AppError('validation', 'The two passwords do not match.', {
          field: 'confirmPassword',
        }),
      );
    }

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
