import { SupabaseAuthRepository, type OAuthFlow } from '@/data/repositories/SupabaseAuthRepository';
import type { Logger } from '@/infrastructure/logging';
import type { OAuthOutcome } from '@/infrastructure/supabase/oauthFlow';
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
    signUp: record('signUp', () => ({
      data: { session: null, user: { ...RAW_SESSION.user, identities: [{ id: 'identity-1' }] } },
      error: null,
    })),
    verifyOtp: record('verifyOtp', () => ({ data: { session: RAW_SESSION }, error: null })),
    resend: record('resend', () => ({ data: {}, error: null })),
    setSession: record('setSession', () => ({ data: { session: RAW_SESSION }, error: null })),
    updateUser: record('updateUser', () => ({ data: { user: RAW_SESSION.user }, error: null })),
    signOut: record('signOut', () => ({ error: null })),
    getSession: record('getSession', () => ({ data: { session: RAW_SESSION }, error: null })),
  };

  const client = { auth } as unknown as TypedSupabaseClient;
  return { client, calls };
}

const repositoryFor = (client: TypedSupabaseClient) =>
  new SupabaseAuthRepository(client, silent, undefined, 'offtexts://auth/reset');

describe('SupabaseAuthRepository', () => {
  describe('Google sign-in', () => {
    // The browser round trip is tested in oauthFlow.test.ts. Here it is a
    // function that reports one outcome, and what is under test is what the
    // member is told about each.
    const withFlow = (outcome: OAuthOutcome | Error) => {
      const { client } = fakeClient();
      const flow: OAuthFlow = async () => {
        if (outcome instanceof Error) throw outcome;
        return outcome;
      };
      return new SupabaseAuthRepository(client, silent, flow, 'offtexts://auth/reset');
    };

    it('returns the session once the browser flow succeeds', async () => {
      const result = await withFlow({ status: 'success' }).signInWithOAuth('google');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value?.user.id).toBe('user-1');
    });

    it('returns no session, and no error, when the member backs out', async () => {
      const result = await withFlow({ status: 'cancelled' }).signInWithOAuth('google');

      expect(result).toEqual({ ok: true, value: null });
    });

    it('says plainly when new accounts are switched off', async () => {
      const result = await withFlow({
        status: 'failed',
        error: 'access_denied',
        errorCode: 'signup_disabled',
        description: 'Signups not allowed for this instance',
      }).signInWithOAuth('google');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('forbidden');
        expect(result.error.message).toMatch(/cannot be created/);
      }
    });

    it('blames the server, retryably, for a server failure', async () => {
      const result = await withFlow({
        status: 'failed',
        error: 'server_error',
        errorCode: 'unexpected_failure',
        description: 'Database error saving new user',
      }).signInWithOAuth('google');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('server');
        expect(result.error.isRetryable).toBe(true);
      }
    });

    it('reports any other refusal as an incomplete sign-in', async () => {
      const result = await withFlow({
        status: 'failed',
        error: 'invalid_request',
        errorCode: 'bad_oauth_state',
        description: 'OAuth state is invalid',
      }).signInWithOAuth('google');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/did not complete/);
    });

    it('classifies a flow that could not reach the network', async () => {
      const result = await withFlow(new TypeError('Network request failed')).signInWithOAuth(
        'google',
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('network');
    });
  });

  describe('sign-up', () => {
    it('asks for the code when the address is new', async () => {
      const { client } = fakeClient();

      const result = await repositoryFor(client).signUpWithPassword({
        email: 'ava@example.com',
        password: 'Correct-horse-9',
      });

      // No session yet: the account exists but is not verified.
      expect(result).toEqual({ ok: true, value: null });
    });

    it('says the account exists when the address is already verified', async () => {
      // Supabase's answer for a registered, verified address: a user with no
      // identities, no session, no error — and no email sent.
      const { client } = fakeClient({
        signUp: () => ({
          data: { session: null, user: { ...RAW_SESSION.user, identities: [] } },
          error: null,
        }),
      });

      const result = await repositoryFor(client).signUpWithPassword({
        email: 'ava@example.com',
        password: 'Correct-horse-9',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.reason).toBe('accountExists');
        expect(result.error.field).toBe('email');
      }
    });
  });

  describe('password reset code', () => {
    it('checks the code as a recovery code', async () => {
      const { client, calls } = fakeClient();

      const result = await repositoryFor(client).verifyRecoveryCode('ava@example.com', '123456');

      expect(result.ok).toBe(true);
      expect(calls).toEqual([
        {
          method: 'verifyOtp',
          args: { email: 'ava@example.com', token: '123456', type: 'recovery' },
        },
      ]);
    });

    it('reports a wrong or expired reset code by its reason', async () => {
      const { client } = fakeClient({
        verifyOtp: () => ({
          data: { session: null },
          error: { name: 'AuthApiError', code: 'otp_expired', status: 403, message: 'x' },
        }),
      });

      const result = await repositoryFor(client).verifyRecoveryCode('ava@example.com', '000000');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.reason).toBe('codeInvalidOrExpired');
    });
  });

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
