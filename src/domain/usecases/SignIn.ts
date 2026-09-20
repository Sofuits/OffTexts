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
 * Signs a member in with an email and password.
 *
 * Checking the email's shape before the network call is not only a nicety: a
 * malformed address is a guaranteed round trip to a rejection, and on a bad
 * Indian mobile connection that is several seconds of the member staring at a
 * spinner to be told something the app already knew.
 *
 * The password is only checked for emptiness. Rules about length or composition
 * belong to sign-up, and enforcing them at sign-in would lock out anyone whose
 * password predates the current rules.
 */
export class SignIn {
  constructor(private readonly auth: AuthRepository) {}

  async execute(credentials: Credentials): Promise<Result<Session>> {
    const email = credentials.email.trim().toLowerCase();

    if (!isValidEmail(email)) {
      return failure(
        new AppError('validation', 'Enter an email like name@example.com.', { field: 'email' }),
      );
    }

    if (credentials.password.length === 0) {
      return failure(new AppError('validation', 'Enter your password.', { field: 'password' }));
    }

    return this.auth.signInWithPassword({ email, password: credentials.password });
  }
}
