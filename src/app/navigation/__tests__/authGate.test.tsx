import { render, screen, waitFor } from '@testing-library/react-native';

import { createTestContainer } from '@/app/di';
import { RootNavigator } from '@/app/navigation';
import { AppProviders, createTestQueryClient } from '@/app/providers';
import type { AuthState, Session } from '@/domain/entities';
import { success, type AuthRepository } from '@/domain/repositories';

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

function renderWith(auth: AuthRepository) {
  const container = createTestContainer({ repositories: { auth } });
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
      expect(screen.queryByTestId('screen-discover')).toBeNull();
      expect(screen.queryByTestId('screen-profile')).toBeNull();
    });
  });

  it('shows the app when signed in, and not the sign-in screen', async () => {
    renderWith(authIn({ status: 'signedIn', session: SESSION }));

    expect(await screen.findByTestId('screen-discover')).toBeTruthy();
    expect(screen.queryByTestId('screen-sign-in')).toBeNull();

    // Wait for Discover's query to settle before the test ends. Without this
    // the in-memory repository resolves after teardown and React warns about a
    // state update outside act() — noise that hides a real warning later.
    expect(await screen.findByText('Aanya Rao, 27')).toBeTruthy();
  });
});
