import path from 'path';

/**
 * The exact addresses Supabase is asked to send members back to.
 *
 * These are the strings that must appear, character for character, in
 * Supabase → Authentication → URL Configuration → Redirect URLs. When one does
 * not, Supabase does not fail: it sends the browser to the Site URL and the app
 * never hears back. So they are checked against the REAL expo-linking, not a
 * mock — a mock is what let `createURL('/auth/callback')` produce
 * `offtexts:///auth/callback` (three slashes) in builds while every test said
 * `offtexts://auth/callback`.
 *
 * Only the runtime is faked: `expo-constants` says whether this is Expo Go or
 * a build, and on which address Metro is serving.
 */

const CREATE_URL = path.join(__dirname, '../../../../node_modules/expo-linking/build/createURL.js');

type Runtime = {
  executionEnvironment: 'storeClient' | 'bare';
  expoConfig: { scheme: string; hostUri?: string };
  expoGoConfig?: { developer: { tool: string } };
  linkingUri?: string;
};

const EXPO_GO: Runtime = {
  executionEnvironment: 'storeClient',
  expoConfig: { scheme: 'offtexts', hostUri: '192.168.1.23:8081' },
  expoGoConfig: { developer: { tool: 'expo-cli' } },
  linkingUri: 'exp://192.168.1.23:8081/--/',
};

// A development build loads its JavaScript from Metro, so it has a host too.
const DEV_BUILD: Runtime = {
  executionEnvironment: 'bare',
  expoConfig: { scheme: 'offtexts', hostUri: '192.168.1.23:8081' },
  expoGoConfig: { developer: { tool: 'expo-cli' } },
};

const STORE_BUILD: Runtime = {
  executionEnvironment: 'bare',
  expoConfig: { scheme: 'offtexts' },
};

type Redirects = { oauth: string; reset: string };

function redirectsIn(runtime: Runtime, os: 'ios' | 'android'): Redirects {
  let result: Redirects | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: runtime,
      ExecutionEnvironment: {
        Bare: 'bare',
        Standalone: 'standalone',
        StoreClient: 'storeClient',
      },
    }));
    jest.doMock('expo-web-browser', () => ({
      maybeCompleteAuthSession: jest.fn(),
      openAuthSessionAsync: jest.fn(),
    }));
    // The real createURL, without the rest of expo-linking's native module.
    // By path: the package's `exports` map does not publish build/ files.
    jest.doMock('expo-linking', () => ({
      createURL: jest.requireActual(CREATE_URL).createURL,
    }));
    // Set on THIS registry's react-native: isolateModules gives oauthFlow a
    // fresh copy, and setting Platform.OS on the test file's copy would leave
    // oauthFlow on the default platform — every case would test iOS.
    (require('react-native') as typeof import('react-native')).Platform.OS = os;
    const flow = require('@/infrastructure/supabase/oauthFlow') as {
      oauthRedirect: () => string;
      passwordResetRedirect: () => string;
    };
    result = { oauth: flow.oauthRedirect(), reset: flow.passwordResetRedirect() };
  });
  return result as Redirects;
}

describe('the redirect addresses Supabase must allow', () => {
  it('is one offtexts:// address per link in a build, on both platforms', () => {
    for (const build of [DEV_BUILD, STORE_BUILD]) {
      for (const os of ['ios', 'android'] as const) {
        expect(redirectsIn(build, os)).toEqual({
          oauth: 'offtexts://auth/callback',
          reset: 'offtexts://auth/reset',
        });
      }
    }
  });

  it('never has three slashes', () => {
    for (const runtime of [EXPO_GO, DEV_BUILD, STORE_BUILD]) {
      for (const os of ['ios', 'android'] as const) {
        const { oauth, reset } = redirectsIn(runtime, os);
        expect(oauth).not.toContain(':///');
        expect(reset).not.toContain(':///');
      }
    }
  });

  it('in Expo Go on Android, is an address on the developer machine', () => {
    expect(redirectsIn(EXPO_GO, 'android')).toEqual({
      oauth: 'exp://192.168.1.23:8081/--/auth/callback',
      reset: 'exp://192.168.1.23:8081/--/auth/reset',
    });
  });

  it('in Expo Go on iPhone, still returns to offtexts:// for sign-in', () => {
    // iOS's sign-in sheet catches the app's own scheme itself, so no Expo Go
    // address is needed for Google. The reset link, opened from Mail, is a
    // normal deep link and does need Expo Go's.
    expect(redirectsIn(EXPO_GO, 'ios')).toEqual({
      oauth: 'offtexts://auth/callback',
      reset: 'exp://192.168.1.23:8081/--/auth/reset',
    });
  });
});
