import { SupabaseAuthRepository } from '@/data/repositories/SupabaseAuthRepository';
import type { Logger } from '@/infrastructure/logging';
import type { TypedSupabaseClient } from '@/infrastructure/supabase/supabaseClient';

/**
 * The Supabase auth repository, against a hand-written client.
 *
 * Only the handful of `client.auth` methods these tests reach are provided.
 * What is under test is what the repository ASKS Supabase for — the scope of a
 * sign-out, the type of a code — because getting those wrong fails silently
 * against the real service: a sign-out that leaves other devices signed in, a
 * code check that always says "expired".
 */

type Call = { method: string; args: unknown };

const silent: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  captureException: () => {},
  setUser: () => {},
};

const RAW_SESSION = { user: { id: 'user-1', email: 'ava@example.com' } };

function fakeClient(overrides: Record<string, (args: unknown) => unknown> = {}) {
  const calls: Call[] = [];
  const record =
    (method: string, fallback: (args: unknown) => unknown) => async (args: unknown) => {
      calls.push({ method, args });
      return (overrides[method] ?? fallback)(args);
    };

  const auth = {
    verifyOtp: record('verifyOtp', () => ({ data: { session: RAW_SESSION }, error: null })),
    resend: record('resend', () => ({ data: {}, error: null })),
    setSession: record('setSession', () => ({ data: { session: RAW_SESSION }, error: null })),
    updateUser: record('updateUser', () => ({ data: { user: RAW_SESSION.user }, error: null })),
    signOut: record('signOut', () => ({ error: null })),
  };

  const client = { auth } as unknown as TypedSupabaseClient;
  return { client, calls };
}

const repositoryFor = (client: TypedSupabaseClient) =>
  new SupabaseAuthRepository(client, silent, undefined, 'offtexts://auth/reset');

describe('SupabaseAuthRepository', () => {
  describe('sign-up code', () => {
    it('checks the code as an email OTP and returns the session', async () => {
      const { client, calls } = fakeClient();

      const result = await repositoryFor(client).verifySignUpCode('ava@example.com', '123456');

      expect(calls).toEqual([
        { method: 'verifyOtp', args: { email: 'ava@example.com', token: '123456', type: 'email' } },
      ]);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.user.id).toBe('user-1');
    });

    it('reports a wrong or expired code by its reason', async () => {
      const { client } = fakeClient({
        verifyOtp: () => ({
          data: { session: null },
          error: { name: 'AuthApiError', code: 'otp_expired', status: 403, message: 'x' },
        }),
      });

      const result = await repositoryFor(client).verifySignUpCode('ava@example.com', '000000');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.reason).toBe('codeInvalidOrExpired');
    });

    it('resends the sign-up code, not a magic link', async () => {
      const { client, calls } = fakeClient();

      await repositoryFor(client).resendSignUpCode('ava@example.com');

      expect(calls).toEqual([
        { method: 'resend', args: { type: 'signup', email: 'ava@example.com' } },
      ]);
    });

    it('surfaces a resend rate limit with the server’s wait', async () => {
      const { client } = fakeClient({
        resend: () => ({
          data: {},
          error: {
            name: 'AuthApiError',
            code: 'over_email_send_rate_limit',
            status: 429,
            message: 'For security purposes, you can only request this after 12 seconds.',
          },
        }),
      });

      const result = await repositoryFor(client).resendSignUpCode('ava@example.com');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('rateLimited');
        expect(result.error.retryAfterSeconds).toBe(12);
      }
    });
  });

  describe('sign-out', () => {
    it('signs out every session, not just this device', async () => {
      const { client, calls } = fakeClient();

      const result = await repositoryFor(client).signOut();

      expect(result.ok).toBe(true);
      expect(calls).toEqual([{ method: 'signOut', args: { scope: 'global' } }]);
    });

    it('reports a sign-out the server did not receive', async () => {
      const { client } = fakeClient({
        signOut: () => ({
          error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' },
        }),
      });

      const result = await repositoryFor(client).signOut();

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('network');
    });
  });

  describe('password recovery', () => {
    it('starts a session from the tokens in the reset link', async () => {
      const { client, calls } = fakeClient();

      const result = await repositoryFor(client).beginPasswordRecovery(
        'offtexts://auth/reset#access_token=at&expires_in=3600&refresh_token=rt&type=recovery',
      );

      expect(result.ok).toBe(true);
      expect(calls).toEqual([
        { method: 'setSession', args: { access_token: 'at', refresh_token: 'rt' } },
      ]);
    });

    it('says the link expired, without touching the session, when Supabase says so', async () => {
      const { client, calls } = fakeClient();

      const result = await repositoryFor(client).beginPasswordRecovery(
        'offtexts://auth/reset#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      );

      expect(calls).toEqual([]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.reason).toBe('codeInvalidOrExpired');
        expect(result.error.message).toMatch(/new one/);
      }
    });

    it('rejects a link with nothing in it', async () => {
      const { client, calls } = fakeClient();

      const result = await repositoryFor(client).beginPasswordRecovery('offtexts://auth/reset');

      expect(calls).toEqual([]);
      expect(result.ok).toBe(false);
    });

    it('sets the new password on the signed-in member', async () => {
      const { client, calls } = fakeClient();

      const result = await repositoryFor(client).updatePassword('correct horse battery');

      expect(result.ok).toBe(true);
      expect(calls).toEqual([
        { method: 'updateUser', args: { password: 'correct horse battery' } },
      ]);
    });
  });
});
