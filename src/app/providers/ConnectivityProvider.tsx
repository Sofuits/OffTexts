import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { useServices } from '@/app/di';
import type { ConnectivityState } from '@/infrastructure/network';

/**
 * One connectivity subscription for the whole app.
 *
 * Before this, every component calling `useConnectivity` opened its own NetInfo
 * listener — with three tabs mounted and an OfflineBanner on each, that is four
 * native subscriptions all reporting the same thing, and four identical log
 * lines every time the radio twitches.
 *
 * NetInfo also re-emits on changes that do not matter to us (signal strength,
 * cellular generation), so the state is only published when the values this app
 * actually reads have changed. That turns a stream of duplicate renders into
 * one render when something genuinely happened.
 */

export type Connectivity = ConnectivityState & { isOnline: boolean };

const INITIAL: Connectivity = {
  // Optimistic on purpose: assuming offline before NetInfo answers flashes an
  // offline banner on every cold start, including for people who are online.
  isConnected: true,
  isInternetReachable: true,
  type: 'unknown',
  isOnline: true,
};

const ConnectivityContext = createContext<Connectivity>(INITIAL);

export function ConnectivityProvider({ children }: PropsWithChildren): React.JSX.Element {
  const { connectivity, logger } = useServices();
  const [state, setState] = useState<Connectivity>(INITIAL);

  useEffect(() => {
    return connectivity.subscribe((next) => {
      const resolved: Connectivity = {
        ...next,
        isOnline: next.isConnected && next.isInternetReachable,
      };

      setState((previous) => {
        const unchanged =
          previous.isOnline === resolved.isOnline &&
          previous.isConnected === resolved.isConnected &&
          previous.isInternetReachable === resolved.isInternetReachable &&
          previous.type === resolved.type;

        if (unchanged) return previous;

        logger.info('Connectivity changed', { online: resolved.isOnline, type: resolved.type });
        return resolved;
      });
    });
  }, [connectivity, logger]);

  return <ConnectivityContext.Provider value={state}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivityState(): Connectivity {
  return useContext(ConnectivityContext);
}
