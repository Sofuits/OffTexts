import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { Session } from '@/domain/entities';
import { createAdminContainer, type AdminContainer } from '@admin/lib/container';

/**
 * Who is signed in, and whether the database considers them staff.
 *
 * Two separate questions, and the second one is not ours to answer. The portal
 * asks `public.is_staff()` rather than reading a role out of the session,
 * because anything the browser holds can be edited by whoever holds it. Even if
 * someone forced `isStaff` to true here, every query would still return nothing
 * — the RLS policies are the control, and this flag only decides what the
 * screen says while they find that out.
 */

type State =
  | { status: 'loading' }
  | { status: 'misconfigured'; message: string }
  | { status: 'signedOut' }
  | { status: 'checking'; session: Session }
  | { status: 'notStaff'; session: Session }
  | { status: 'ready'; session: Session };

type SessionValue = {
  state: State;
  container: AdminContainer | null;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Built once, in a lazy initialiser, so a missing .env produces a readable
  // screen rather than a white page and a console stack trace.
  const [built] = useState<{ container: AdminContainer } | { error: string }>(() => {
    try {
      return { container: createAdminContainer() };
    } catch (caught) {
      return { error: caught instanceof Error ? caught.message : 'Could not start.' };
    }
  });

  const container = 'container' in built ? built.container : null;
  const [state, setState] = useState<State>(
    'error' in built ? { status: 'misconfigured', message: built.error } : { status: 'loading' },
  );

  useEffect(() => {
    if (!container) return;
    let cancelled = false;

    const unsubscribe = container.repositories.auth.observeAuthState((authState) => {
      if (cancelled) return;

      if (authState.status !== 'signedIn') {
        setState({ status: 'signedOut' });
        return;
      }

      const { session } = authState;
      setState({ status: 'checking', session });

      void container.repositories.admin.amIStaff().then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          // A failed check is not a pass. Treating an error as "probably fine"
          // is how a bug becomes a hole.
          container.logger.error('Staff check failed', result.error);
          setState({ status: 'notStaff', session });
          return;
        }
        setState(result.value ? { status: 'ready', session } : { status: 'notStaff', session });
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [container]);

  const value = useMemo<SessionValue>(
    () => ({
      state,
      container,
      signOut: async () => {
        await container?.repositories.auth.signOut();
      },
    }),
    [state, container],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>.');
  return value;
}

/** The container, for a screen that already knows it is past the staff gate. */
export function useAdmin(): AdminContainer {
  const { container } = useSession();
  if (!container) throw new Error('The admin container is not available.');
  return container;
}
