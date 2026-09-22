import type { Session } from '@/domain/entities';
import type { AuthRepository, Credentials, Result } from '@/domain/repositories';
import { success } from '@/domain/repositories';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, SignUp } from '@/domain/usecases';

/**
 * Sign-up validation.
 *
 * Every rule here is also enforced by Supabase and by the database. These tests
 * are not about whether the rule exists — they are about whether the member
 * finds out before the round trip, and whether the message tells them what to
 * do rather than what went wrong.
 */

const SESSION: Session = { user: { id: 'u1', email: 'ava@example.com', profileId: null } };

function makeAuth(overrides: Partial<AuthRepository> = {}): {
  auth: AuthRepository;
  calls: Credentials[];
} {
  const calls: Credentials[] = [];

  const auth: AuthRepository = {
    getSession: async () => success(null),
    observeAuthState: () => () => undefined,
    signInWithOAuth: async () => success(null),
    signInWithPassword: async () => success(SESSION),
    signUpWithPassword: async (credentials): Promise<Result<Session | null>> => {
      calls.push(credentials);
      return success(SESSION);
    },
    sendMagicLink: async () => success(undefined),
    sendPasswordReset: async () => success(undefined),
    signOut: async () => success(undefined),
    ...overrides,
  };

  return { auth, calls };
}

const valid = {
  email: 'Ava@Example.com ',
  password: 'correct horse battery',
  confirmPassword: 'correct horse battery',
};

describe('SignUp', () => {
  it('normalises the email before sending it', async () => {
    const { auth, calls } = makeAuth();

    const result = await new SignUp(auth).execute(valid);

    expect(result.ok).toBe(true);
    // Trimmed and lowercased. Without this, 'Ava@Example.com' and
    // 'ava@example.com' are two accounts as far as anything that compares
    // strings is concerned.
    expect(calls[0]?.email).toBe('ava@example.com');
  });

  it('rejects a malformed email without calling the network', async () => {
    const { auth, calls } = makeAuth();

    const result = await new SignUp(auth).execute({ ...valid, email: 'ava@' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('validation');
    expect(calls).toHaveLength(0);
  });

  it(`rejects a password shorter than ${MIN_PASSWORD_LENGTH} characters`, async () => {
    const { auth, calls } = makeAuth();

    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    const result = await new SignUp(auth).execute({
      ...valid,
      password: short,
      confirmPassword: short,
    });

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('rejects a password longer than bcrypt will actually hash', async () => {
    const { auth, calls } = makeAuth();

    // bcrypt truncates past 72 bytes. Accepting a longer one would mean two
    // different passwords both work, which is worse than refusing it.
    const long = 'a'.repeat(MAX_PASSWORD_LENGTH + 1);
    const result = await new SignUp(auth).execute({
      ...valid,
      password: long,
      confirmPassword: long,
    });

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('measures the password in bytes, not characters', async () => {
    const { auth, calls } = makeAuth();

    // 20 four-byte emoji is 80 bytes — under the character limit, over the
    // byte limit. Counting characters here would let it through and truncate.
    const emoji = '🙂'.repeat(20);
    const result = await new SignUp(auth).execute({
      ...valid,
      password: emoji,
      confirmPassword: emoji,
    });

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('rejects mismatched passwords and says which field is wrong', async () => {
    const { auth, calls } = makeAuth();

    const result = await new SignUp(auth).execute({ ...valid, confirmPassword: 'something else' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe('confirmPassword');
    expect(calls).toHaveLength(0);
  });

  it('reports confirmationRequired when the project returns no session', async () => {
    // This is the shape of a project with email confirmation switched on: the
    // account exists, but there is no session until the link is clicked. A
    // screen that assumed a session here would show a signed-in app to
    // somebody who cannot load a single row.
    const { auth } = makeAuth({ signUpWithPassword: async () => success(null) });

    const result = await new SignUp(auth).execute(valid);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('confirmationRequired');
      if (result.value.status === 'confirmationRequired') {
        expect(result.value.email).toBe('ava@example.com');
      }
    }
  });

  it('reports signedIn when a session comes back', async () => {
    const { auth } = makeAuth();

    const result = await new SignUp(auth).execute(valid);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('signedIn');
  });
});
