import { MIN_PASSWORD_LENGTH, passwordChecks, validateNewPassword } from '@/domain/usecases';
import { suggestEmailCorrection } from '@/shared/validation';

/**
 * The password rules shown on screen and enforced before sign-up.
 *
 * Each requirement level is Supabase's own. The test is that the app asks for
 * exactly what that level asks for — no more, which would refuse passwords the
 * server accepts, and no less, which would let the server refuse instead.
 */

const ids = (password: string, requirement: Parameters<typeof passwordChecks>[1]) =>
  passwordChecks(password, requirement).map((check) => check.id);

describe('passwordChecks', () => {
  it('asks only for length when the project requires no characters', () => {
    expect(ids('', null)).toEqual(['length']);
  });

  it('lists each character rule for each Supabase level', () => {
    expect(ids('', 'letters_digits')).toEqual(['length', 'letter', 'digit']);
    expect(ids('', 'lower_upper_letters_digits')).toEqual(['length', 'lower', 'upper', 'digit']);
    expect(ids('', 'lower_upper_letters_digits_symbols')).toEqual([
      'length',
      'lower',
      'upper',
      'digit',
      'symbol',
    ]);
  });

  it('ticks off each rule as it is met', () => {
    const checks = passwordChecks('abcdefG1', 'lower_upper_letters_digits_symbols');
    const met = Object.fromEntries(checks.map((check) => [check.id, check.met]));

    expect(met).toEqual({ length: true, lower: true, upper: true, digit: true, symbol: false });
  });
});

describe('validateNewPassword', () => {
  it('names every missing character type', () => {
    const error = validateNewPassword('abcdefgh', 'abcdefgh', 'lower_upper_letters_digits_symbols');

    expect(error?.field).toBe('password');
    expect(error?.message).toMatch(/uppercase/);
    expect(error?.message).toMatch(/number/);
    expect(error?.message).toMatch(/symbol/);
  });

  it('accepts a password meeting every rule', () => {
    const password = 'Correct-horse-9';
    expect(
      validateNewPassword(password, password, 'lower_upper_letters_digits_symbols'),
    ).toBeNull();
  });

  it('keeps the length message when only length is missing', () => {
    const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validateNewPassword(short, short)?.message).toMatch(
      new RegExp(`at least ${MIN_PASSWORD_LENGTH}`),
    );
  });
});

describe('suggestEmailCorrection', () => {
  it.each(['ava@gmial.com', 'ava@gmai.com', 'ava@gmail.co', 'ava@gamil.com', 'Ava@GMAIL.CON'])(
    'suggests gmail.com for %s',
    (typo) => {
      expect(suggestEmailCorrection(typo)).toBe('ava@gmail.com');
    },
  );

  it('suggests nothing for a correct or unrelated address', () => {
    expect(suggestEmailCorrection('ava@gmail.com')).toBeNull();
    expect(suggestEmailCorrection('ava@outlook.com')).toBeNull();
    expect(suggestEmailCorrection('ava')).toBeNull();
  });
});
