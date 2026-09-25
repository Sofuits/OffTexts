import type { Session } from '@/domain/entities';
import { success, type AuthRepository } from '@/domain/repositories';
import {
  MIN_PASSWORD_LENGTH,
  ResendVerificationCode,
  SIGN_UP_CODE_LENGTH,
  UpdatePassword,
  VerifyEmail,
  VerifyPasswordResetCode,
} from '@/domain/usecases';

/**
 * Verifying a new account, resending its code, and setting a new password.
 *
 * What these guard is the round trip that never needs to happen: every code
 * rejected by the server counts against the project's verification rate
 * limit, and every resend against its hourly email allowance.
 */

const SESSION: Session = { user: { id: 'u1', email: 'ava@example.com', profileId: null } };

function makeAuth() {
  const calls = {
    verify: [] as { email: string; code: string }[],
    resend: [] as string[],
    update: [] as string[],
  };

  const auth: AuthRepository = {
    getSession: async () => success(null),
    observeAuthState: () => () => undefined,
    signInWithOAuth: async () => success(null),
    signInWithPassword: async () => success(SESSION),
    signUpWithPassword: async () => success(null),
    verifySignUpCode: async (email, code) => {
      calls.verify.push({ email, code });
      return success(SESSION);
    },
    resendSignUpCode: async (email) => {
      calls.resend.push(email);
      return success(undefined);
    },
    sendMagicLink: async () => success(undefined),
    sendPasswordReset: async () => success(undefined),
    beginPasswordRecovery: async () => success(undefined),
    verifyRecoveryCode: async () => success(undefined),
    updatePassword: async (password) => {
      calls.update.push(password);
      return success(undefined);
    },
    signOut: async () => success(undefined),
  };

  return { auth, calls };
}

const VALID_CODE = '1'.repeat(SIGN_UP_CODE_LENGTH);

describe('VerifyEmail', () => {
  it('normalises the email and sends the code', async () => {
    const { auth, calls } = makeAuth();

    const result = await new VerifyEmail(auth).execute({
      email: ' Ava@Example.com ',
      code: VALID_CODE,
    });

    expect(result.ok).toBe(true);
    expect(calls.verify).toEqual([{ email: 'ava@example.com', code: VALID_CODE }]);
  });

  it('accepts a code pasted with spaces in it', async () => {
    const { auth, calls } = makeAuth();
    const spaced = `${VALID_CODE.slice(0, 3)} ${VALID_CODE.slice(3)}`;

    await new VerifyEmail(auth).execute({ email: 'ava@example.com', code: spaced });

    expect(calls.verify[0]?.code).toBe(VALID_CODE);
  });

  it.each([
    ['too short', VALID_CODE.slice(1)],
    ['too long', `${VALID_CODE}1`],
    ['not digits', 'a'.repeat(SIGN_UP_CODE_LENGTH)],
    ['empty', ''],
  ])('rejects a code that is %s without calling the server', async (_label, code) => {
    const { auth, calls } = makeAuth();

    const result = await new VerifyEmail(auth).execute({ email: 'ava@example.com', code });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe('code');
    expect(calls.verify).toHaveLength(0);
  });
});

describe('VerifyPasswordResetCode', () => {
  const recording = () => {
    const { auth } = makeAuth();
    const checked: { email: string; code: string }[] = [];
    auth.verifyRecoveryCode = async (email, code) => {
      checked.push({ email, code });
      return success(undefined);
    };
    return { auth, checked };
  };

  it('normalises the email and sends the code', async () => {
    const { auth, checked } = recording();

    const result = await new VerifyPasswordResetCode(auth).execute({
      email: ' Ava@Example.com ',
      code: `${VALID_CODE.slice(0, 3)} ${VALID_CODE.slice(3)}`,
    });

    expect(result.ok).toBe(true);
    expect(checked).toEqual([{ email: 'ava@example.com', code: VALID_CODE }]);
  });

  it('rejects a code of the wrong shape without calling the server', async () => {
    const { auth, checked } = recording();

    const result = await new VerifyPasswordResetCode(auth).execute({
      email: 'ava@example.com',
      code: VALID_CODE.slice(1),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe('code');
    expect(checked).toHaveLength(0);
  });
});

describe('ResendVerificationCode', () => {
  it('resends to the normalised address', async () => {
    const { auth, calls } = makeAuth();

    await new ResendVerificationCode(auth).execute(' Ava@Example.com');

    expect(calls.resend).toEqual(['ava@example.com']);
  });

  it('does not send for a malformed address', async () => {
    const { auth, calls } = makeAuth();

    const result = await new ResendVerificationCode(auth).execute('not-an-email');

    expect(result.ok).toBe(false);
    expect(calls.resend).toHaveLength(0);
  });
});

describe('UpdatePassword', () => {
  it('applies the sign-up rules before saving', async () => {
    const { auth, calls } = makeAuth();
    const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);

    const result = await new UpdatePassword(auth).execute({
      password: short,
      confirmPassword: short,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe('password');
    expect(calls.update).toHaveLength(0);
  });

  it('rejects mismatched passwords', async () => {
    const { auth, calls } = makeAuth();

    const result = await new UpdatePassword(auth).execute({
      password: 'correct horse battery',
      confirmPassword: 'correct hose battery',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe('confirmPassword');
    expect(calls.update).toHaveLength(0);
  });

  it('saves a valid password', async () => {
    const { auth, calls } = makeAuth();

    const result = await new UpdatePassword(auth).execute({
      password: 'correct horse battery',
      confirmPassword: 'correct horse battery',
    });

    expect(result.ok).toBe(true);
    expect(calls.update).toEqual(['correct horse battery']);
  });
});
