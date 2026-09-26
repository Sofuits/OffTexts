import { AppError, type AuthRepository, failure, type Result } from '@/domain/repositories';
import { isValidEmail } from '@/shared/validation';

/**
 * Emails the sign-up code again.
 *
 * Deliberately no retry and no client-side schedule: every send counts against
 * the project's hourly email allowance, which is shared by every member. The
 * screen decides when the button is available; this only makes the one call.
 */
export class ResendVerificationCode {
  constructor(private readonly auth: AuthRepository) {}

  async execute(email: string): Promise<Result<void>> {
    const address = email.trim().toLowerCase();

    if (!isValidEmail(address)) {
      return failure(
        new AppError('validation', 'Enter an email like name@example.com.', { field: 'email' }),
      );
    }

    return this.auth.resendSignUpCode(address);
  }
}
