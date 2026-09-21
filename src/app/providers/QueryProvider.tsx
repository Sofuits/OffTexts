import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import React, { useEffect, useMemo, type PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { AppError } from '@/domain/repositories';
import { useServices } from '@/app/di';

/**
 * Server state, on TanStack Query.
 *
 * React Query's defaults are written for the web, where a tab is either focused
 * or not and the network is usually fine. Two of them must be corrected for a
 * phone or the app misbehaves in ways that look like bugs elsewhere:
 *
 *   onlineManager — by default it listens to the browser's `navigator.onLine`,
 *     which does not exist in React Native. Left alone, React Query believes it
 *     is permanently online and will not pause or resume around connectivity.
 *
 *   focusManager — the web equivalent of "the app came back" is a window focus
 *     event. On a phone it is AppState. Without this wiring, a refetch-on-focus
 *     never fires and the member sees data from before they locked the screen.
 */

const FIVE_MINUTES = 5 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function buildQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Mobile data costs money and battery. Five minutes of staleness is a
        // better trade than a refetch every time a tab is touched.
        staleTime: FIVE_MINUTES,
        gcTime: TWENTY_FOUR_HOURS,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,

        retry: (failureCount, error) => {
          // AppError already knows whether trying again could help. Retrying a
          // 403 from an RLS policy three times is three guaranteed failures and
          // three seconds of the member watching a spinner.
          if (error instanceof AppError) {
            return error.isRetryable && failureCount < 2;
          }
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        // Never retry a write by default. A retried "request meet" books two.
        retry: false,
      },
    },
  });
}

/**
 * A client with retries and caching switched off, for tests.
 *
 * Without it, a test asserting an error state waits out two retries and an
 * exponential backoff before the query settles — which reads as a flaky
 * timeout rather than as the deliberate retry policy it is.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

type QueryProviderProps = PropsWithChildren<{
  /** Injected by tests. Production leaves it undefined. */
  client?: QueryClient;
}>;

export function QueryProvider({
  children,
  client: injected,
}: QueryProviderProps): React.JSX.Element {
  const { connectivity } = useServices();
  const client = useMemo(() => injected ?? buildQueryClient(), [injected]);

  useEffect(() => {
    // No logging here: ConnectivityProvider owns that, and only reports a
    // genuine change. NetInfo re-emits on things this app does not care about.
    return onlineManager.setEventListener((setOnline) =>
      connectivity.subscribe((state) => {
        setOnline(state.isConnected && state.isInternetReachable);
      }),
    );
  }, [connectivity]);

  useEffect(() => {
    const handle = (status: AppStateStatus): void => {
      focusManager.setFocused(status === 'active');
    };
    const subscription = AppState.addEventListener('change', handle);
    return () => subscription.remove();
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
