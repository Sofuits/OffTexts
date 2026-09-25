import type { Session } from '@/domain/entities';
import { AppError, type AuthRepository, failure, type Result } from '@/domain/repositories';
import { isValidEmail } from '@/shared/validation';

/**
 * How many digits the sign-up code has.
 *
 * It mirrors a Supabase Dashboard setting, not a choice made here:
 * Authentication → Sign In / Providers → Email → Email OTP Length, currently 6.
 * If that setting changes, this must change with it, or every correct code is
 * rejected before it reaches the server.
 */
export const SIGN_UP_CODE_LENGTH = 6;

const CODE_PATTERN = new RegExp(`^\\d{${SIGN_UP_CODE_LENGTH}}$`);

/**
 * Confirms a new account with the code from the sign-up email.
 *
 * The shape of the code is checked here because a wrong-length code is a
 * guaranteed rejection, and every rejected attempt counts against the
 * project's token verification rate limit. Spaces are stripped: a code pasted
 * from an email often arrives as "123 456".
 */
export class VerifyEmail {
  constructor(private readonly auth: AuthRepository) {}

  async execute(input: { email: string; code: string }): Promise<Result<Session>> {
    const email = input.email.trim().toLowerCase();
    const code = input.code.replace(/\s/g, '');

    if (!isValidEmail(email)) {
      return failure(
        new AppError('validation', 'Enter an email like name@example.com.', { field: 'email' }),
      );
    }

    if (!CODE_PATTERN.test(code)) {
      return failure(
        new AppError('validation', `Enter the ${SIGN_UP_CODE_LENGTH}-digit code from the email.`, {
          field: 'code',
        }),
      );
    }

    return this.auth.verifySignUpCode(email, code);
  }
}
