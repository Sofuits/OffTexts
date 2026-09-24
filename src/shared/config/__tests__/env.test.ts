import type { Env } from '@/shared/config/env';

/**
 * `env` is computed once, at import, from `expo-constants`. Each case mocks
 * that module with a given `extra` and imports a fresh copy of env.ts.
 */
function envWith(extra: Record<string, string>): Env {
  let loaded: Env | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra } },
    }));
    loaded = (require('@/shared/config/env') as { env: Env }).env;
  });
  return loaded as Env;
}

/** Everything the demo sign-in needs, so only `environment` varies. */
const DEMO = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon-key',
  demoEmail: 'demo@example.com',
  demoPassword: 'throwaway',
};

describe('env.hasDemoSignIn', () => {
  // Also the gate for the developer tools on the profile tab (reset
  // onboarding), so this is what keeps both out of a store build.
  it('is on outside production when everything it needs is set', () => {
    expect(envWith({ ...DEMO, environment: 'development' }).hasDemoSignIn).toBe(true);
    expect(envWith({ ...DEMO, environment: 'staging' }).hasDemoSignIn).toBe(true);
  });

  it('is off in production even when everything it needs is set', () => {
    expect(envWith({ ...DEMO, environment: 'production' }).hasDemoSignIn).toBe(false);
  });
});
