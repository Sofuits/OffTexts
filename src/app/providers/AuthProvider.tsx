import { useQueryClient } from '@tanstack/react-query';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Linking } from 'react-native';

import { useRepositories, useServices } from '@/app/di';
import type { AuthState } from '@/domain/entities';
import type { Credentials } from '@/domain/repositories';

/**
 * The authentication state of the app.
 *
 * It subscribes rather than fetching once, because a session can end without
 * the app asking — a refresh fails, the account is deleted, the member signs
 * out on another device. A one-off read at startup would leave the app
 * believing in a session that no longer exists.
 *
 * `restoring` is a distinct state from `signedOut` and the difference is
 * visible to the member: reading the stored session takes a moment, and
 * treating that moment as signed-out flashes the sign-in screen at someone who
 * is already signed in. Every app that flickers on launch has skipped this.
 */

/**
 * Where a member is in resetting a forgotten password.
 *
 * Tracked here rather than as a route because the reset link SIGNS THE MEMBER
 * IN. Left to the ordinary gate, a signed-in member is shown the app — so the
 * gate has to know that this particular session exists only to choose a new
 * password, and put that screen in front of everything until it is done.
 */
export type PasswordRecovery =
  | { status: 'none' }
  /** The link arrived. The session is being set, or has been. */
  | { status: 'active' }
  /** The link was expired, used or malformed. */
  | { status: 'failed'; message: string };

type AuthContextValue = {
  state: AuthState;
  isRestoring: boolean;
  isSignedIn: boolean;
  passwordRecovery: PasswordRecovery;
  /** Leave the reset screen: after a new password is saved, or to give up. */
  endPasswordRecovery: () => void;
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The path in `passwordResetRedirect()` — `offtexts://auth/reset` in a
 * development or store build, `exp://…/--/auth/reset` under Expo Go.
 */
const RESET_LINK = /(^|[/:])auth\/reset([/?#]|$)/;

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const { auth } = useRepositories();
  const { logger, analytics } = useServices();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'restoring' });
  const [passwordRecovery, setPasswordRecovery] = useState<PasswordRecovery>({ status: 'none' });
  const wasSignedIn = useRef(false);

  useEffect(() => {
    return auth.observeAuthState((next) => {
      setState(next);

      if (next.status === 'signedIn') {
        wasSignedIn.current = true;
        logger.setUser({ id: next.session.user.id, email: next.session.user.email });
        analytics.identify(next.session.user.id);
      } else if (next.status === 'signedOut') {
        // Detach the member from any later crash report or analytics event.
        logger.setUser(null);
        analytics.reset();

        // Everything React Query holds in memory belongs to the member who
        // just left. Only on a real sign-out: clearing on the first signedOut
        // at launch would throw away nothing, but it would also hide a bug.
        if (wasSignedIn.current) {
          wasSignedIn.current = false;
          queryClient.clear();
        }
      }
    });
  }, [auth, logger, analytics, queryClient]);

  // Password reset links, whether they cold-start the app or arrive while it
  // is open. The recovery state is set BEFORE the session is, so the gate
  // never has a frame in which a signed-in member is shown the app instead.
  useEffect(() => {
    let active = true;

    const handle = async (url: string | null): Promise<void> => {
      if (!url || !RESET_LINK.test(url)) return;

      setPasswordRecovery({ status: 'active' });
      const result = await auth.beginPasswordRecovery(url);
      if (!active) return;
      if (!result.ok) setPasswordRecovery({ status: 'failed', message: result.error.message });
    };

    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', ({ url }) => void handle(url));

    return () => {
      active = false;
      subscription.remove();
    };
  }, [auth]);

  const endPasswordRecovery = useCallback(() => setPasswordRecovery({ status: 'none' }), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      isRestoring: state.status === 'restoring',
      isSignedIn: state.status === 'signedIn',
      passwordRecovery,
      endPasswordRecovery,
      signIn: async (credentials) => {
        const result = await auth.signInWithPassword(credentials);
        // The subscription above updates the state, so nothing is set here.
        if (!result.ok) throw result.error;
      },
      signOut: async () => {
        const result = await auth.signOut();
        if (!result.ok) throw result.error;
      },
    }),
    [state, passwordRecovery, endPasswordRecovery, auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an <AuthProvider>.');
  return context;
}
