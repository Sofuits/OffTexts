import { useConnectivityState, type Connectivity } from '@/app/providers/ConnectivityProvider';

/**
 * Whether the device can reach the internet.
 *
 * Reads the single app-wide subscription rather than opening one of its own,
 * so a screen can call this freely without adding a native listener.
 */
export function useConnectivity(): Connectivity {
  return useConnectivityState();
}
