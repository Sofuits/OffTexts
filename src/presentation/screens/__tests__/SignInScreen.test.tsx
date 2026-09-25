import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createTestContainer } from '@/app/di';
import { AppProviders, createTestQueryClient } from '@/app/providers';
import type { Session } from '@/domain/entities';
import {
  AppError,
  failure,
  success,
  type AuthRepository,
  type Credentials,
  type Result,
} from '@/domain/repositories';
import { SignInScreen } from '@/presentation/screens';
import { env } from '@/shared/config';

/**
 * The first screen anyone sees, and the one that was a dead end.
 *
 * Tapping "Continue with Google" used to return "Unsupported provider: provider
 * is not enabled" — nothing the member could act on, on the first screen of the
 * app. The fix is not a better error message: it is that the button is not
 * offered until the provider exists, and that email and password is a real path
 * rather than a developer toggle.
 *
 * The auth repository is invented here, so this runs with no Supabase, no
 * network and no module mocking. What is under test is the screen's contract
 * with the interface.
 */

const SESSION: Session = { user: { id: 'u1', email: 'ava@example.com', profileId: null } };

type Recorder = {
  signIns: Credentials[];
  signUps: Credentials[];
  resets: string[];
};

function fakeAuth(recorder: Recorder, overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    getSession: async () => success(null),
    observeAuthState: (listener) => {
      listener({ status: 'signedOut' });
      return () => undefined;
    },
    signInWithOAuth: async () => success(null),
    signInWithPassword: async (credentials): Promise<Result<Session>> => {
      recorder.signIns.push(credentials);
      return success(SESSION);
    },
    signUpWithPassword: async (credentials): Promise<Result<Session | null>> => {
      recorder.signUps.push(credentials);
      return success(SESSION);
    },
    sendMagicLink: async () => success(undefined),
    verifySignUpCode: async () => success(SESSION),
    resendSignUpCode: async () => success(undefined),
    beginPasswordRecovery: async () => success(undefined),
    updatePassword: async () => success(undefined),
    sendPasswordReset: async (email) => {
      recorder.resets.push(email);
      return success(undefined);
    },
    signOut: async () => success(undefined),
    ...overrides,
  };
}

function renderScreen(overrides: Partial<AuthRepository> = {}): Recorder {
  const recorder: Recorder = { signIns: [], signUps: [], resets: [] };
  const container = createTestContainer({
    repositories: { auth: fakeAuth(recorder, overrides) },
  });

  render(
    <AppProviders container={container} queryClient={createTestQueryClient()}>
      <SignInScreen />
    </AppProviders>,
  );

  return recorder;
}

describe('SignInScreen', () => {
  it('does not offer Google until the provider is configured', () => {
    // The default is off, so this is the state the app ships in today. The
    // assertion is the whole point of the flag: no button rather than a button
    // that fails.
    expect(env.enableGoogleAuth).toBe(false);

    renderScreen();

    expect(screen.queryByTestId('button-google-sign-in')).toBeNull();
  });

  it('signs in with an email and password', async () => {
    const recorder = renderScreen();

    fireEvent.changeText(screen.getByTestId('input-email'), 'ava@example.com');
    fireEvent.changeText(screen.getByTestId('input-password'), 'correct horse battery');
    fireEvent.press(screen.getByTestId('button-submit'));

    await waitFor(() => expect(recorder.signIns).toHaveLength(1));
    expect(recorder.signIns[0]?.email).toBe('ava@example.com');
  });

  it('marks a malformed email on the field and does not send it', async () => {
    const recorder = renderScreen();

    fireEvent.changeText(screen.getByTestId('input-email'), 'ava@example');
    fireEvent.changeText(screen.getByTestId('input-password'), 'correct horse battery');
    fireEvent.press(screen.getByTestId('button-submit'));

    expect(await screen.findByText('Enter an email like name@example.com.')).toBeTruthy();
    expect(recorder.signIns).toHaveLength(0);
  });

  it('suggests gmail.com for a mistyped Gmail address', async () => {
    renderScreen();

    fireEvent.changeText(screen.getByTestId('input-email'), 'ava@gmial.com');
    fireEvent(screen.getByTestId('input-email'), 'blur');

    fireEvent.press(await screen.findByTestId('button-use-suggested-email'));

    expect(screen.getByTestId('input-email').props.value).toBe('ava@gmail.com');
    expect(screen.queryByTestId('button-use-suggested-email')).toBeNull();
  });

  it('lists the password rules while creating an account', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('link-sign-up'));

    expect(screen.getByTestId('password-checklist')).toBeTruthy();
    expect(screen.getByTestId('password-rule-length')).toBeTruthy();
  });

  it('will not submit with an empty email or password', () => {
    renderScreen();

    // Disabled rather than submitting and showing an error. A round trip to be
    // told the app already knew is several seconds on a bad connection.
    expect(screen.getByTestId('button-submit').props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('input-email'), 'ava@example.com');
    expect(screen.getByTestId('button-submit').props.accessibilityState?.disabled).toBe(true);
  });

  it('creates an account, confirming the password first', async () => {
    const recorder = renderScreen();

    fireEvent.press(screen.getByTestId('link-sign-up'));

    fireEvent.changeText(screen.getByTestId('input-email'), 'ava@example.com');
    fireEvent.changeText(screen.getByTestId('input-password'), 'correct horse battery');
    fireEvent.changeText(screen.getByTestId('input-confirm-password'), 'correct hose battery');
    fireEvent.press(screen.getByTestId('button-submit'));

    // A typo in a field you cannot read locks you out of an account you have
    // just made, so this never reaches the network.
    await waitFor(() => expect(screen.getByTestId('sign-in-error')).toBeTruthy());
    expect(recorder.signUps).toHaveLength(0);

    fireEvent.changeText(screen.getByTestId('input-confirm-password'), 'correct horse battery');
    fireEvent.press(screen.getByTestId('button-submit'));

    await waitFor(() => expect(recorder.signUps).toHaveLength(1));
  });

  it('asks for the emailed code when confirmation is required', async () => {
    renderScreen({ signUpWithPassword: async () => success(null) });

    fireEvent.press(screen.getByTestId('link-sign-up'));
    fireEvent.changeText(screen.getByTestId('input-email'), 'ava@example.com');
    fireEvent.changeText(screen.getByTestId('input-password'), 'correct horse battery');
    fireEvent.changeText(screen.getByTestId('input-confirm-password'), 'correct horse battery');
    fireEvent.press(screen.getByTestId('button-submit'));

    await waitFor(() => expect(screen.getByTestId('screen-verify-email')).toBeTruthy());
    expect(screen.getByText(/ava@example\.com/)).toBeTruthy();
  });

  it('offers verification, without sending an email, when the address is not verified', async () => {
    const resends: string[] = [];
    renderScreen({
      signInWithPassword: async () =>
        failure(
          new AppError('unauthenticated', 'Your email is not verified yet.', {
            reason: 'emailNotConfirmed',
          }),
        ),
      resendSignUpCode: async (email) => {
        resends.push(email);
        return success(undefined);
      },
    });

    fireEvent.changeText(screen.getByTestId('input-email'), 'Ava@Example.com');
    fireEvent.changeText(screen.getByTestId('input-password'), 'correct horse battery');
    fireEvent.press(screen.getByTestId('button-submit'));

    await waitFor(() => expect(screen.getByTestId('button-go-verify')).toBeTruthy());
    fireEvent.press(screen.getByTestId('button-go-verify'));

    expect(screen.getByTestId('screen-verify-email')).toBeTruthy();
    expect(screen.getByText(/ava@example\.com/)).toBeTruthy();
    // Every send counts against the project's hourly allowance, and the member
    // may still have the first code. A resend is theirs to ask for.
    expect(resends).toHaveLength(0);
  });

  it('does not offer verification for a wrong password', async () => {
    renderScreen({
      signInWithPassword: async () =>
        failure(
          new AppError('unauthenticated', 'That email and password do not match.', {
            reason: 'invalidCredentials',
          }),
        ),
    });

    fireEvent.changeText(screen.getByTestId('input-email'), 'ava@example.com');
    fireEvent.changeText(screen.getByTestId('input-password'), 'wrong');
    fireEvent.press(screen.getByTestId('button-submit'));

    await waitFor(() => expect(screen.getByTestId('sign-in-error')).toBeTruthy());
    expect(screen.queryByTestId('button-go-verify')).toBeNull();
  });

  it('never reveals whether an address has an account', async () => {
    const recorder = renderScreen();

    fireEvent.press(screen.getByTestId('link-reset'));
    fireEvent.changeText(screen.getByTestId('input-email'), 'stranger@example.com');
    fireEvent.press(screen.getByTestId('button-submit'));

    await waitFor(() => expect(recorder.resets).toHaveLength(1));

    // "If … has an account" is deliberate. Saying "no account with that email"
    // would turn this form into a way to find out who is on Offtexts, which
    // for a dating app is a disclosure in itself.
    const notice = String(screen.getByTestId('sign-in-notice').props.children);
    expect(notice).toContain('If ');
  });

  it('clears a stale error when switching mode', async () => {
    renderScreen({
      signInWithPassword: async () =>
        failure(new AppError('unauthenticated', 'Those details did not match.')),
    });

    fireEvent.changeText(screen.getByTestId('input-email'), 'ava@example.com');
    fireEvent.changeText(screen.getByTestId('input-password'), 'wrong');
    fireEvent.press(screen.getByTestId('button-submit'));

    await waitFor(() => expect(screen.getByTestId('sign-in-error')).toBeTruthy());

    fireEvent.press(screen.getByTestId('link-sign-up'));

    // Otherwise the member is told to fix something that is no longer on screen.
    expect(screen.queryByTestId('sign-in-error')).toBeNull();
  });
});
