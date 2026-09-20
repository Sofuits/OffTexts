import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

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

type AuthContextValue = {
  state: AuthState;
  isRestoring: boolean;
  isSignedIn: boolean;
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const { auth } = useRepositories();
  const { logger, analytics } = useServices();
  const [state, setState] = useState<AuthState>({ status: 'restoring' });

  useEffect(() => {
    return auth.observeAuthState((next) => {
      setState(next);

      if (next.status === 'signedIn') {
        logger.setUser({ id: next.session.user.id, email: next.session.user.email });
        analytics.identify(next.session.user.id);
      } else if (next.status === 'signedOut') {
        // Detach the member from any later crash report or analytics event.
        logger.setUser(null);
        analytics.reset();
      }
    });
  }, [auth, logger, analytics]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      isRestoring: state.status === 'restoring',
      isSignedIn: state.status === 'signedIn',
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
    [state, auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an <AuthProvider>.');
  return context;
}
