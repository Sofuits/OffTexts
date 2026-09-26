import { AppError } from '@/domain/repositories';

/**
 * The rules for any password a member chooses: at sign-up and when resetting.
 *
 * One file so the two cannot drift, and so the checklist on screen and the
 * check before submitting are the same code. A reset that accepted what
 * sign-up rejected would be a way round the minimum.
 */

/**
 * The shortest password the product will accept.
 *
 * Eight, not six. Supabase's own default is six and that is too short to be
 * worth having. It must match Authentication → Sign In / Providers → Email →
 * Minimum password length in the Supabase Dashboard.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * bcrypt, which Supabase uses, silently truncates beyond 72 BYTES. A member
 * whose password is longer would find that only the first 72 bytes mattered,
 * and — worse — that pasting a slightly different long password still worked.
 * Rejecting it up front is honest; truncating it quietly is not.
 */
export const MAX_PASSWORD_LENGTH = 72;

/**
 * Which characters a password must contain.
 *
 * NOT a product decision made here. These are the options of the Supabase
 * Dashboard setting Authentication → Sign In / Providers → Email → Password
 * requirements, spelled as Supabase spells them, and the app must use the one
 * the project is set to. Null means "no required characters", Supabase's
 * default — and the better policy, since forced composition pushes people
 * towards `Password1!` rather than towards a long passphrase.
 */
export const PASSWORD_REQUIREMENTS = [
  'letters_digits',
  'lower_upper_letters_digits',
  'lower_upper_letters_digits_symbols',
] as const;

export type PasswordRequirement = (typeof PASSWORD_REQUIREMENTS)[number] | null;

/** The symbol set Supabase checks against for the symbols requirement. */
const SYMBOLS = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~';

export type PasswordCheck = { id: string; label: string; met: boolean };

/**
 * Every rule that applies, and whether `password` meets it.
 *
 * Drives both the live checklist under the field and validateNewPassword, so
 * the member is told every rule before the server has to refuse anything.
 */
export function passwordChecks(
  password: string,
  requirement: PasswordRequirement,
): PasswordCheck[] {
  const checks: PasswordCheck[] = [
    {
      id: 'length',
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
  ];

  if (requirement === 'letters_digits') {
    checks.push({ id: 'letter', label: 'A letter', met: /[A-Za-z]/.test(password) });
  }

  if (
    requirement === 'lower_upper_letters_digits' ||
    requirement === 'lower_upper_letters_digits_symbols'
  ) {
    checks.push(
      { id: 'lower', label: 'A lowercase letter', met: /[a-z]/.test(password) },
      { id: 'upper', label: 'An uppercase letter', met: /[A-Z]/.test(password) },
    );
  }

  if (requirement !== null) {
    checks.push({ id: 'digit', label: 'A number', met: /\d/.test(password) });
  }

  if (requirement === 'lower_upper_letters_digits_symbols') {
    checks.push({
      id: 'symbol',
      label: 'A symbol, such as ! @ # $ %',
      met: [...password].some((character) => SYMBOLS.includes(character)),
    });
  }

  return checks;
}

/**
 * @returns The problem, or null when the password is acceptable.
 */
export function validateNewPassword(
  password: string,
  confirmPassword: string,
  requirement: PasswordRequirement = null,
): AppError | null {
  const unmet = passwordChecks(password, requirement).filter((check) => !check.met);

  if (unmet.length > 0) {
    const onlyLength = unmet.length === 1 && unmet[0]?.id === 'length';
    return new AppError(
      'validation',
      onlyLength
        ? `Use at least ${MIN_PASSWORD_LENGTH} characters. A few words you will remember beats a short jumble you will not.`
        : `Your password needs: ${unmet.map((check) => check.label.toLowerCase()).join(', ')}.`,
      { field: 'password' },
    );
  }

  // Byte length, not character length: an emoji is four bytes and a member
  // using them would hit bcrypt's limit long before 72 characters.
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_LENGTH) {
    return new AppError(
      'validation',
      `Passwords cannot be longer than ${MAX_PASSWORD_LENGTH} bytes.`,
      {
        field: 'password',
      },
    );
  }

  if (password !== confirmPassword) {
    return new AppError('validation', 'The two passwords do not match.', {
      field: 'confirmPassword',
    });
  }

  return null;
}
