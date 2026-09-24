import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { createTestContainer } from '@/app/di';
import { RootNavigator } from '@/app/navigation';
import { AppProviders, createTestQueryClient } from '@/app/providers';
import type { AuthState, Person, Session } from '@/domain/entities';
import {
  AppError,
  failure,
  success,
  type AuthRepository,
  type ProfileRepository,
} from '@/domain/repositories';
import { env } from '@/shared/config';

/**
 * The authentication gate.
 *
 * The most important test in stage 2. Getting this wrong does not produce a
 * crash — it produces an app that shows a signed-out member somebody else's
 * data, or flashes a sign-in screen at someone already signed in. Both are
 * invisible to a type check and easy to miss by hand.
 */

const SESSION: Session = {
  user: { id: 'user-1', email: 'you@example.com', profileId: 'person-1' },
};

/** An auth repository parked in one state, so each state can be asserted. */
function authIn(state: AuthState): AuthRepository {
  return {
    getSession: async () => success(state.status === 'signedIn' ? state.session : null),
    observeAuthState: (listener) => {
      listener(state);
      return () => {};
    },
    signInWithOAuth: async () => success(SESSION),
    signInWithPassword: async () => success(SESSION),
    signUpWithPassword: async () => success(SESSION),
    sendMagicLink: async () => success(undefined),
    sendPasswordReset: async () => success(undefined),
    signOut: async () => success(undefined),
  };
}

/**
 * A profile as the signup trigger leaves it: a row exists, nothing is answered.
 *
 * `handle_new_user()` writes `name: 'New member'`, `city: 'Pune'` and nothing
 * else, so the existence of a profile says nothing about whether somebody has
 * been through onboarding. This is the shape that has to reach the wizard.
 */
const FRESH: Person = {
  id: 'person-1',
  name: 'New member',
  headline: '',
  city: 'Pune',
  photoUrls: [],
  interests: [],
  intents: [],
  verification: 'unverified',
};

function profileReturning(person: Person): ProfileRepository {
  return {
    getMyProfile: async () => success(person),
    getProfileById: async () => success(person),
    updateMyProfile: async () => success(person),
  };
}

function renderWith(auth: AuthRepository, profile?: ProfileRepository) {
  const container = createTestContainer({
    repositories: profile ? { auth, profile } : { auth },
  });
  return render(
    <AppProviders container={container} queryClient={createTestQueryClient()}>
      <RootNavigator />
    </AppProviders>,
  );
}

describe('auth gate', () => {
  it('shows the splash while the stored session is being read', async () => {
    renderWith(authIn({ status: 'restoring' }));

    expect(await screen.findByTestId('screen-splash')).toBeTruthy();
    // Crucially NOT the sign-in screen: that flash is what this state exists
    // to prevent.
    expect(screen.queryByTestId('screen-sign-in')).toBeNull();
  });

  it('shows the sign-in screen when signed out', async () => {
    renderWith(authIn({ status: 'signedOut' }));

    expect(await screen.findByTestId('screen-sign-in')).toBeTruthy();
    // Email and password, not Google. Google is behind env.enableGoogleAuth,
    // which is false until the provider actually exists — see SignInScreen.
    expect(await screen.findByTestId('button-submit')).toBeTruthy();
  });

  it('never shows the tabs to a signed-out member', async () => {
    renderWith(authIn({ status: 'signedOut' }));

    await screen.findByTestId('screen-sign-in');
    // The tab screens must not be mounted underneath — if they are, a back
    // gesture reaches them.
    await waitFor(() => {
      expect(screen.queryByTestId('screen-today')).toBeNull();
      expect(screen.queryByTestId('screen-profile')).toBeNull();
    });
  });

  it('shows the app when signed in, and not the sign-in screen', async () => {
    renderWith(authIn({ status: 'signedIn', session: SESSION }));

    // Today, not the wizard: the seeded profile has a date of birth and an
    // intent, so `hasCompletedOnboarding` is true. See AuthedArea.
    expect(await screen.findByTestId('screen-today')).toBeTruthy();
    expect(screen.queryByTestId('screen-sign-in')).toBeNull();
    expect(screen.queryByTestId('onboarding-step-1')).toBeNull();

    // Wait for Today's query to settle before the test ends. Without this the
    // in-memory repository resolves after teardown and React warns about a
    // state update outside act() — noise that hides a real warning later.
    expect(await screen.findByText('Person 1 of 3')).toBeTruthy();
  });

  it('sends a member with an unfinished profile to the wizard, not the tabs', async () => {
    renderWith(authIn({ status: 'signedIn', session: SESSION }), profileReturning(FRESH));

    expect(await screen.findByTestId('onboarding-step-1')).toBeTruthy();
    // Not the tabs underneath either. A half-built profile must not be able to
    // reach Today, because the candidate rules would have nothing to match on.
    expect(screen.queryByTestId('screen-today')).toBeNull();
  });

  it('shows the app rather than the wizard when the profile cannot be read', async () => {
    const offline: ProfileRepository = {
      getMyProfile: async () => failure(new AppError('network', 'No connection.')),
      getProfileById: async () => failure(new AppError('network', 'No connection.')),
      updateMyProfile: async () => failure(new AppError('network', 'No connection.')),
    };

    renderWith(authIn({ status: 'signedIn', session: SESSION }), offline);

    // A network error is not evidence of an incomplete profile, and sending
    // somebody through onboarding again would write over what they have.
    expect(await screen.findByTestId('screen-today')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-step-1')).toBeNull();
  });
});

/**
 * The dev-only "Reset onboarding" on the profile tab.
 *
 * Tested here rather than on the screen because what matters is the gate: the
 * button has to put a signed-in member back in the wizard with no reload.
 */
describe('reset onboarding (development only)', () => {
  afterEach(() => jest.restoreAllMocks());

  async function openProfileTab(): Promise<void> {
    await screen.findByText('Person 1 of 3');
    fireEvent.press(screen.getByText('Profile'));
    await screen.findByTestId('button-sign-out');
  }

  it('is not offered without the demo flag, which production never has', async () => {
    expect(env.hasDemoSignIn).toBe(false);

    renderWith(authIn({ status: 'signedIn', session: SESSION }));
    await openProfileTab();

    expect(screen.queryByTestId('button-reset-onboarding')).toBeNull();
  });

  it('sends a finished member back to the wizard', async () => {
    jest.replaceProperty(env, 'hasDemoSignIn', true);
    // Presses "Reset" in the confirmation, as the member would.
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
      buttons?.find((button) => button.text === 'Reset')?.onPress?.();
    });

    renderWith(authIn({ status: 'signedIn', session: SESSION }));
    await openProfileTab();

    fireEvent.press(screen.getByTestId('button-reset-onboarding'));

    expect(await screen.findByTestId('onboarding-step-1')).toBeTruthy();
    expect(screen.queryByTestId('screen-profile')).toBeNull();
  });
});
