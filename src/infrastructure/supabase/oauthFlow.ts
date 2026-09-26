import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { AppError } from '@/domain/repositories';
import { readAuthLink } from './authLinks';
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
 *   3. The browser redirects back to the app — see `oauthRedirect()` — with
 *      the tokens in the URL fragment, and the auth session hands that URL
 *      straight back to this function.
 *   4. Hand those tokens to `setSession`, which is what makes the client — and
 *      therefore every repository — authenticated. `onAuthStateChange` then
 *      moves the app on, exactly as for any other sign-in.
 *
 * This works in a development or store build and in Expo Go. The address the
 * browser returns to is chosen by `oauthRedirect()`, and must be allowed in
 * Supabase.
 */

/** Finishes any auth session left dangling by a previous attempt. */
WebBrowser.maybeCompleteAuthSession();

export type OAuthOutcome =
  | { status: 'success' }
  /** The member closed the browser, or said no on the consent screen. Not an error. */
  | { status: 'cancelled' }
  /**
   * Supabase sent the browser back with an error instead of a session —
   * sign-ups switched off, say, or the new account failing to save. Reported
   * rather than thrown so the repository, which has the logger and knows the
   * member-facing wording, decides what to say.
   */
  | {
      status: 'failed';
      error: string | null;
      errorCode: string | null;
      description: string | null;
    };

/**
 * Where the provider's sign-in page sends the member back to.
 *
 * ON IPHONE it is always the app's own address, `offtexts://auth/callback` —
 * the one an installed build uses. iOS's sign-in sheet
 * (ASWebAuthenticationSession) watches for that scheme itself and hands the
 * address straight back to this code, so nothing has to be registered with the
 * system: it comes back to the app inside Expo Go too, with no Expo Go address
 * to list in Supabase.
 *
 * ON ANDROID the system has to deliver the address to an app that registered
 * it, so it is built by expo-linking from the scheme in app.config.ts:
 * `offtexts://auth/callback` in a development or store build, and
 * `exp://<this computer>:8081/--/auth/callback` in Expo Go.
 *
 * Whichever it is MUST BE LISTED in Supabase under Authentication → URL
 * Configuration → Redirect URLs. When it is not, Supabase does not fail: it
 * sends the browser — with the new session in its address — to the Site URL
 * instead, and the app never hears back. The composition root logs it in
 * development.
 */
export function oauthRedirect(): string {
  if (Platform.OS === 'ios') {
    const configured = Constants.expoConfig?.scheme;
    const scheme = Array.isArray(configured) ? configured[0] : configured;
    if (scheme) return `${scheme}://auth/callback`;
  }
  return Linking.createURL('/auth/callback');
}

/**
 * Where a password reset email should send the member back to.
 *
 * Built from the scheme in app.config.ts by expo-linking, exactly like the
 * OAuth callback above, so the two cannot drift apart. It lives in this file
 * because this is already the one place in the data path that is allowed to
 * touch a native module — every other file in `data/` has to load in a browser
 * for the admin portal, and expo-linking does not.
 *
 * IT MUST ALSO BE LISTED in the Supabase dashboard under Authentication → URL
 * Configuration → Redirect URLs. When it is not, Supabase does not fail: it
 * quietly substitutes the project's site URL, and the member taps the link on
 * their phone and lands on a web page instead of in the app.
 */
export function passwordResetRedirect(): string {
  return Linking.createURL('/auth/reset');
}

export async function runOAuthFlow(
  client: TypedSupabaseClient,
  provider: 'google',
): Promise<OAuthOutcome> {
  const redirectTo = oauthRedirect();

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

  const link = readAuthLink(result.url);

  if (link.kind === 'error') {
    // Saying no on Google's consent screen comes back as a bare
    // `access_denied`, with no Supabase error code: the member backed out.
    // Supabase's own refusals (sign-ups disabled, for one) also use
    // `access_denied`, but always add an `error_code` — so they are failures.
    if (link.error === 'access_denied' && !link.errorCode) return { status: 'cancelled' };
    return {
      status: 'failed',
      error: link.error,
      errorCode: link.errorCode,
      description: link.description,
    };
  }

  if (link.kind === 'none') {
    throw new AppError('unauthenticated', 'Sign-in did not complete. Try again.');
  }

  const { error: sessionError } = await client.auth.setSession({
    access_token: link.accessToken,
    refresh_token: link.refreshToken,
  });

  if (sessionError) throw sessionError;

  return { status: 'success' };
}
