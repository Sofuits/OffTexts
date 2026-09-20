import { AppState, type AppStateStatus } from 'react-native';

import type { TypedSupabaseClient } from './supabaseClient';

/**
 * Starts and stops Supabase's token refresh timer with the app's lifecycle.
 *
 * Supabase refreshes the access token on a timer. A background timer on a phone
 * is unreliable: iOS suspends it, Android doze delays it. Left running, it
 * wakes to find the token already expired and the refresh fails, which signs
 * the member out for no reason they can see.
 *
 * The documented fix is to stop the timer on background and start it on
 * foreground — Supabase then refreshes once, immediately, when the app comes
 * back. It is easy to miss, and the symptom (random sign-outs, usually
 * overnight) is hard to attribute.
 */
export function bridgeSupabaseToAppState(client: TypedSupabaseClient): () => void {
  const handle = (status: AppStateStatus): void => {
    if (status === 'active') {
      void client.auth.startAutoRefresh();
    } else {
      void client.auth.stopAutoRefresh();
    }
  };

  // The app is already in the foreground when this runs at startup.
  handle(AppState.currentState);

  const subscription = AppState.addEventListener('change', handle);
  return () => subscription.remove();
}
