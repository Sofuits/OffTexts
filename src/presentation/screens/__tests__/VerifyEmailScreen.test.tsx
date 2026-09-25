import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createTestContainer } from '@/app/di';
import { AppProviders, createTestQueryClient } from '@/app/providers';
import type { Session } from '@/domain/entities';
import { AppError, failure, success, type AuthRepository } from '@/domain/repositories';
import { SIGN_UP_CODE_LENGTH } from '@/domain/usecases';
import { VerifyEmailScreen } from '@/presentation/screens';
import { env } from '@/shared/config';

/**
 * Entering the sign-up code, and asking for another.
 *
 * The resend button is the part with rules. It must wait as long as the
 * server will refuse — no less, or the member taps a button that fails — and
 * it must not invent a wait the server never asked for.
 */

const SESSION: Session = { user: { id: 'u1', email: 'ava@example.com', profileId: null } };
const CODE = '1'.repeat(SIGN_UP_CODE_LENGTH);

/** `env` is a plain object; the cooldown is set per test and restored after. */
const mutableEnv = env as { authResendCooldownSeconds: number | null };
const configuredCooldown = env.authResendCooldownSeconds;
afterEach(() => {
  mutableEnv.authResendCooldownSeconds = configuredCooldown;
});

function fakeAuth(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    getSession: async () => success(null),
    observeAuthState: (listener) => {
      listener({ status: 'signedOut' });
      return () => undefined;
    },
    signInWithOAuth: async () => success(null),
    signInWithPassword: async () => success(SESSION),
    signUpWithPassword: async () => success(null),
    verifySignUpCode: async () => success(SESSION),
    resendSignUpCode: async () => success(undefined),
    sendMagicLink: async () => success(undefined),
    sendPasswordReset: async () => success(undefined),
    beginPasswordRecovery: async () => success(undefined),
    updatePassword: async () => success(undefined),
    signOut: async () => success(undefined),
    ...overrides,
  };
}

function renderScreen(overrides: Partial<AuthRepository> = {}, codeJustSent = true) {
  const onBack = jest.fn();
  const container = createTestContainer({ repositories: { auth: fakeAuth(overrides) } });

  render(
    <AppProviders container={container} queryClient={createTestQueryClient()}>
      <VerifyEmailScreen email="ava@example.com" codeJustSent={codeJustSent} onBack={onBack} />
    </AppProviders>,
  );

  return { onBack };
}

const resendDisabled = () =>
  screen.getByTestId('button-resend').props.accessibilityState?.disabled === true;

describe('VerifyEmailScreen', () => {
  it('sends the code for this email', async () => {
    const verified: { email: string; code: string }[] = [];
    renderScreen({
      verifySignUpCode: async (email, code) => {
        verified.push({ email, code });
        return success(SESSION);
      },
    });

    fireEvent.changeText(screen.getByTestId('input-code'), CODE);
    fireEvent.press(screen.getByTestId('button-verify'));

    await waitFor(() => expect(verified).toEqual([{ email: 'ava@example.com', code: CODE }]));
  });

  it('will not submit until the code is the full length', () => {
    renderScreen();

    fireEvent.changeText(screen.getByTestId('input-code'), CODE.slice(1));

    expect(screen.getByTestId('button-verify').props.accessibilityState?.disabled).toBe(true);
  });

  it('says so when the code is wrong or expired', async () => {
    renderScreen({
      verifySignUpCode: async () =>
        failure(
          new AppError('validation', 'That code is wrong or has expired.', {
            reason: 'codeInvalidOrExpired',
            field: 'code',
          }),
        ),
    });

    fireEvent.changeText(screen.getByTestId('input-code'), CODE);
    fireEvent.press(screen.getByTestId('button-verify'));

    await waitFor(() =>
      expect(screen.getByTestId('verify-error').props.children).toMatch(/expired/),
    );
  });

  it('offers a resend immediately when no cooldown is configured', () => {
    mutableEnv.authResendCooldownSeconds = null;
    renderScreen();

    expect(resendDisabled()).toBe(false);
  });

  it('waits the configured cooldown after a code has just been sent', () => {
    mutableEnv.authResendCooldownSeconds = 45;
    renderScreen();

    expect(resendDisabled()).toBe(true);
    expect(screen.getByText(/in 45s/)).toBeTruthy();
  });

  it('does not wait when arriving without a fresh code', () => {
    mutableEnv.authResendCooldownSeconds = 45;
    renderScreen({}, false);

    expect(resendDisabled()).toBe(false);
  });

  it('waits as long as the server says when a resend is rate limited', async () => {
    mutableEnv.authResendCooldownSeconds = null;
    renderScreen({
      resendSignUpCode: async () =>
        failure(
          new AppError('rateLimited', 'Too many emails have been requested.', {
            reason: 'rateLimited',
            retryAfterSeconds: 21,
          }),
        ),
    });

    fireEvent.press(screen.getByTestId('button-resend'));

    await waitFor(() => expect(screen.getByTestId('verify-error')).toBeTruthy());
    expect(resendDisabled()).toBe(true);
    expect(screen.getByText(/in 21s/)).toBeTruthy();
  });

  it('invents no wait when the server gives no figure', async () => {
    mutableEnv.authResendCooldownSeconds = null;
    renderScreen({
      resendSignUpCode: async () =>
        failure(
          new AppError('rateLimited', 'Too many emails have been requested.', {
            reason: 'rateLimited',
          }),
        ),
    });

    fireEvent.press(screen.getByTestId('button-resend'));

    await waitFor(() => expect(screen.getByTestId('verify-error')).toBeTruthy());
    expect(resendDisabled()).toBe(false);
  });

  it('confirms a successful resend', async () => {
    mutableEnv.authResendCooldownSeconds = null;
    const sent: string[] = [];
    renderScreen({
      resendSignUpCode: async (email) => {
        sent.push(email);
        return success(undefined);
      },
    });

    fireEvent.press(screen.getByTestId('button-resend'));

    await waitFor(() => expect(screen.getByTestId('verify-notice')).toBeTruthy());
    expect(sent).toEqual(['ava@example.com']);
  });

  it('goes back to sign in', () => {
    const { onBack } = renderScreen();

    fireEvent.press(screen.getByTestId('link-back'));

    expect(onBack).toHaveBeenCalled();
  });
});
