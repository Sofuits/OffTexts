import { AppError, type AuthRepository, failure, type Result } from '@/domain/repositories';
import { isValidEmail } from '@/shared/validation';
import { SIGN_UP_CODE_LENGTH } from './VerifyEmail';

const CODE_PATTERN = new RegExp(`^\\d{${SIGN_UP_CODE_LENGTH}}$`);

/**
 * Checks the code from a password reset email.
 *
 * The same shape as the sign-up code — Supabase's one "Email OTP Length"
 * setting governs both — and checked here for the same reason: a wrong-length
 * code is a guaranteed rejection that still counts against the project's token
 * verification rate limit. Spaces are stripped, as a pasted code often has one.
 */
export class VerifyPasswordResetCode {
  constructor(private readonly auth: AuthRepository) {}

  async execute(input: { email: string; code: string }): Promise<Result<void>> {
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

    return this.auth.verifyRecoveryCode(email, code);
  }
}
