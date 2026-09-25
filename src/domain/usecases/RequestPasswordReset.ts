import { AppError, type AuthRepository, failure, type Result } from '@/domain/repositories';
import { isValidEmail } from '@/shared/validation';

/**
 * Emails a password reset link.
 *
 * Resolves when the mail has been handed to the provider, not when the link is
 * clicked — there is no way to know the latter from here, and a screen that
 * waited for it would wait forever.
 *
 * DELIBERATELY INDISTINGUISHABLE FOR AN UNKNOWN ADDRESS.
 * If this reported "no account with that email", the form would be a way to
 * find out who is on Offtexts: type an address, read the answer. For a product
 * where membership is itself sensitive — this is a dating app — that is a real
 * disclosure, not a theoretical one.
 *
 * Supabase behaves this way already. The reason it is written down here is that
 * the obvious "improvement" is to tell the member their address was not found,
 * and somebody will eventually propose it as a usability fix.
 */
export class RequestPasswordReset {
  constructor(private readonly auth: AuthRepository) {}

  async execute(email: string): Promise<Result<void>> {
    const address = email.trim().toLowerCase();

    if (!isValidEmail(address)) {
      return failure(
        new AppError('validation', 'Enter an email like name@example.com.', { field: 'email' }),
      );
    }

    return this.auth.sendPasswordReset(address);
  }
}
