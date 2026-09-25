import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { AppError } from '@/domain/repositories';
import { oauthRedirect, runOAuthFlow } from '@/infrastructure/supabase/oauthFlow';
import type { TypedSupabaseClient } from '@/infrastructure/supabase/supabaseClient';

/**
 * The native OAuth round trip: ask Supabase for Google's page, open it in the
 * system browser, read what comes back.
 *
 * The system browser is a native module, so it is the one thing replaced here
 * — with whatever the browser would have returned. Supabase is a hand-written
 * client. What is under test is how each possible return is read, because a
 * mistake there either shows "sign-in failed" to someone who pressed cancel or
 * silently swallows a real refusal.
 */

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

// What expo-linking builds inside Expo Go: an address on the developer's machine.
jest.mock('expo-linking', () => ({
  createURL: (path: string) => `exp://192.168.0.2:8081/--${path}`,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { scheme: 'offtexts' } },
}));

const CALLBACK = 'offtexts://auth/callback';
const EXPO_GO_CALLBACK = 'exp://192.168.0.2:8081/--/auth/callback';
const platform = Platform.OS;
const GOOGLE_PAGE = 'https://project.supabase.co/auth/v1/authorize?provider=google';
const openAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;

function fakeClient(overrides: { signInError?: unknown; setSessionError?: unknown } = {}) {
  const signInWithOAuth = jest.fn(async () => ({
    data: { url: overrides.signInError ? null : GOOGLE_PAGE },
    error: overrides.signInError ?? null,
  }));
  const setSession = jest.fn(async () => ({
    data: {},
    error: overrides.setSessionError ?? null,
  }));
  const client = { auth: { signInWithOAuth, setSession } } as unknown as TypedSupabaseClient;
  return { client, signInWithOAuth, setSession };
}

const browserReturns = (result: object) => openAuthSession.mockResolvedValueOnce(result);

beforeEach(() => {
  openAuthSession.mockReset();
  Platform.OS = 'ios';
});
afterAll(() => {
  Platform.OS = platform;
});

describe('oauthRedirect', () => {
  it('returns an iPhone to the app’s own address, even inside Expo Go', () => {
    // iOS's sign-in sheet catches the scheme itself, so no Expo Go address is needed.
    Platform.OS = 'ios';
    expect(oauthRedirect()).toBe(CALLBACK);
  });

  it('keeps the address Expo builds on Android — the Expo Go one in Expo Go', () => {
    Platform.OS = 'android';
    expect(oauthRedirect()).toBe(EXPO_GO_CALLBACK);
  });
});

describe('runOAuthFlow', () => {
  it('asks Supabase for the Google page, returning to the app, and opens it', async () => {
    const { client, signInWithOAuth } = fakeClient();
    browserReturns({ type: 'cancel' });

    await runOAuthFlow(client, 'google');

    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({ redirectTo: CALLBACK, skipBrowserRedirect: true }),
      }),
    );
    // The auth browser, told where to stop — not an in-app WebView.
    expect(openAuthSession).toHaveBeenCalledWith(GOOGLE_PAGE, CALLBACK);
  });

  it('starts the session from the tokens Supabase sends back', async () => {
    const { client, setSession } = fakeClient();
    browserReturns({
      type: 'success',
      url: `${CALLBACK}#access_token=at&expires_in=3600&refresh_token=rt&token_type=bearer`,
    });

    await expect(runOAuthFlow(client, 'google')).resolves.toEqual({ status: 'success' });
    expect(setSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
  });

  it.each(['cancel', 'dismiss'])('treats a browser %s as the member backing out', async (type) => {
    const { client, setSession } = fakeClient();
    browserReturns({ type });

    await expect(runOAuthFlow(client, 'google')).resolves.toEqual({ status: 'cancelled' });
    expect(setSession).not.toHaveBeenCalled();
  });

  it('treats saying no on the consent screen as backing out, not an error', async () => {
    const { client } = fakeClient();
    browserReturns({
      type: 'success',
      url: `${CALLBACK}#error=access_denied&error_description=The+user+denied+the+request`,
    });

    await expect(runOAuthFlow(client, 'google')).resolves.toEqual({ status: 'cancelled' });
  });

  it('reports a refusal from Supabase itself, rather than swallowing it', async () => {
    // Also `access_denied`, but with Supabase's own error code.
    const { client, setSession } = fakeClient();
    browserReturns({
      type: 'success',
      url: `${CALLBACK}#error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance`,
    });

    await expect(runOAuthFlow(client, 'google')).resolves.toEqual({
      status: 'failed',
      error: 'access_denied',
      errorCode: 'signup_disabled',
      description: 'Signups not allowed for this instance',
    });
    expect(setSession).not.toHaveBeenCalled();
  });

  it('reports a server failure with its description', async () => {
    const { client } = fakeClient();
    browserReturns({
      type: 'success',
      url: `${CALLBACK}?error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user`,
    });

    await expect(runOAuthFlow(client, 'google')).resolves.toMatchObject({
      status: 'failed',
      error: 'server_error',
      description: 'Database error saving new user',
    });
  });

  it('fails plainly when the return carries neither a session nor an error', async () => {
    const { client } = fakeClient();
    browserReturns({ type: 'success', url: CALLBACK });

    await expect(runOAuthFlow(client, 'google')).rejects.toBeInstanceOf(AppError);
  });

  it('passes on an error from Supabase before the browser opens', async () => {
    const failure = { name: 'AuthApiError', status: 400, code: 'validation_failed' };
    const { client } = fakeClient({ signInError: failure });

    await expect(runOAuthFlow(client, 'google')).rejects.toBe(failure);
    expect(openAuthSession).not.toHaveBeenCalled();
  });

  it('passes on an error from setting the session', async () => {
    const failure = { name: 'AuthApiError', status: 401, code: 'bad_jwt' };
    const { client } = fakeClient({ setSessionError: failure });
    browserReturns({ type: 'success', url: `${CALLBACK}#access_token=at&refresh_token=rt` });

    await expect(runOAuthFlow(client, 'google')).rejects.toBe(failure);
  });
});
