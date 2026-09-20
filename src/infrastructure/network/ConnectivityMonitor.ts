import NetInfo from '@react-native-community/netinfo';

/**
 * Whether the device can reach the internet.
 *
 * `isConnected` and `isInternetReachable` are not the same thing and the
 * difference is the whole point: a phone on café Wi-Fi behind a captive portal
 * is connected and cannot reach anything. Treating those as equivalent is why
 * apps show "you're offline" to people with signal, and spinners to people
 * without.
 *
 * `isInternetReachable` is null while NetInfo is still deciding. Null is
 * treated as online, because assuming offline would block the first request on
 * every cold start.
 */

export type ConnectivityState = {
  isConnected: boolean;
  isInternetReachable: boolean;
  /** 'wifi', 'cellular', 'none', 'unknown'… */
  type: string;
};

export interface ConnectivityMonitor {
  getState(): Promise<ConnectivityState>;
  /** @returns An unsubscribe function. */
  subscribe(listener: (state: ConnectivityState) => void): () => void;
}

export class NetInfoConnectivityMonitor implements ConnectivityMonitor {
  async getState(): Promise<ConnectivityState> {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? true,
      type: state.type,
    };
  }

  subscribe(listener: (state: ConnectivityState) => void): () => void {
    return NetInfo.addEventListener((state) => {
      listener({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? true,
        type: state.type,
      });
    });
  }
}

/** Always online. For tests and for the web preview. */
export class AlwaysOnlineMonitor implements ConnectivityMonitor {
  async getState(): Promise<ConnectivityState> {
    return { isConnected: true, isInternetReachable: true, type: 'unknown' };
  }

  subscribe(listener: (state: ConnectivityState) => void): () => void {
    listener({ isConnected: true, isInternetReachable: true, type: 'unknown' });
    return () => {};
  }
}
