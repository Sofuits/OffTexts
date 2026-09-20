import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { AppError } from '@/domain/repositories';
import type { TypedSupabaseClient } from './supabaseClient';

/**
 * The OAuth round trip, native-style.
 *
 * On the web, `signInWithOAuth` redirects the page and Supabase reads the
 * tokens back out of the URL. There is no page to redirect in a native app, so
 * the flow has to be driven by hand:
 *
 *   1. Ask Supabase for the provider's authorisation URL, but tell it NOT to
 *      redirect (`skipBrowserRedirect`).
 *   2. Open that URL in the system's auth browser — SFSafariViewController on
 *      iOS, Custom Tabs on Android. NOT a WebView: Google blocks OAuth in
 *      embedded WebViews outright (`disallowed_useragent`), because an app
 *      hosting a WebView can read the password typed into it.
 *   3. The browser redirects back to our own scheme, `offtexts://`, carrying
 *      the tokens in the URL fragment.
 *   4. Hand those tokens to `setSession`, which is what makes the client — and
 *      therefore every repository — authenticated.
 *
 * Step 3 is why this needs a development build. Expo Go owns the `exp://`
 * scheme and cannot hand a custom-scheme redirect to our code.
 */

/** Finishes any auth session left dangling by a previous attempt. */
WebBrowser.maybeCompleteAuthSession();

export type OAuthOutcome =
  | { status: 'success' }
  /** The member closed the browser. Not an error. */
  | { status: 'cancelled' };

/** Pulls `access_token` and `refresh_token` out of the redirect URL. */
function readTokens(url: string): { accessToken: string; refreshToken: string } | null {
  // Supabase returns them in the fragment (#), not the query string, so they
  // never reach a server log. URL parsing has to account for that.
  const fragment = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? (url.split('?')[1] ?? '').split('#')[0] : '';
  const params = new URLSearchParams(fragment || query || '');

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function runOAuthFlow(
  client: TypedSupabaseClient,
  provider: 'google',
): Promise<OAuthOutcome> {
  // Built from the scheme in app.config.ts, so it cannot drift from it.
  const redirectTo = Linking.createURL('/auth/callback');

  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        // Without these Google issues no refresh token on repeat sign-ins, and
        // the member is silently signed out when the access token expires.
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  if (!data.url) throw new AppError('server', 'The sign-in provider returned no URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    // 'cancel' and 'dismiss' both mean the member backed out.
    return { status: 'cancelled' };
  }

  const tokens = readTokens(result.url);
  if (!tokens) {
    // The provider can redirect back with `?error=access_denied` when consent
    // is refused, which lands here rather than as a cancellation.
    const denied = result.url.includes('error=access_denied');
    if (denied) return { status: 'cancelled' };
    throw new AppError('unauthenticated', 'Sign-in did not complete. Try again.');
  }

  const { error: sessionError } = await client.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  if (sessionError) throw sessionError;

  return { status: 'success' };
}
