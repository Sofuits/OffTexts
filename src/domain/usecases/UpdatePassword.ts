import { type AuthRepository, failure, type Result } from '@/domain/repositories';
import { type PasswordRequirement, validateNewPassword } from './passwordRules';

/**
 * Sets a new password, after following a reset link.
 *
 * The same rules as sign-up, from the same function — see validateNewPassword.
 */
export class UpdatePassword {
  constructor(
    private readonly auth: AuthRepository,
    /** The project's Supabase "Password requirements" setting. */
    private readonly passwordRequirement: PasswordRequirement = null,
  ) {}

  async execute(input: { password: string; confirmPassword: string }): Promise<Result<void>> {
    const problem = validateNewPassword(
      input.password,
      input.confirmPassword,
      this.passwordRequirement,
    );
    if (problem) return failure(problem);

    return this.auth.updatePassword(input.password);
  }
}
