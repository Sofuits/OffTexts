import type { AuthState, Session } from '@/domain/entities';
import {
  AppError,
  failure,
  success,
  type AuthRepository,
  type Result,
} from '@/domain/repositories';
import { SignInWithGoogle, SignOut } from '@/domain/usecases';

const SESSION: Session = {
  user: { id: 'user-1', email: 'you@example.com', profileId: null },
};

function authRepository(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    getSession: async () => success(null),
    observeAuthState: (listener: (state: AuthState) => void) => {
      listener({ status: 'signedOut' });
      return () => {};
    },
    signInWithOAuth: async () => success(SESSION),
    signInWithPassword: async () => success(SESSION),
    signUpWithPassword: async () => success(SESSION),
    sendMagicLink: async () => success(undefined),
    signOut: async () => success(undefined),
    ...overrides,
  };
}

describe('SignInWithGoogle', () => {
  it('reports a session when sign-in completes', async () => {
    const result = await new SignInWithGoogle(authRepository()).execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('signedIn');
  });

  it('reports cancellation as its own outcome, not as an error', async () => {
    // The member opened the browser and backed out. Telling them "sign-in
    // failed" would make a working app look broken, so this must never surface
    // as an error.
    const cancelled = authRepository({
      signInWithOAuth: async (): Promise<Result<Session | null>> => success(null),
    });

    const result = await new SignInWithGoogle(cancelled).execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('cancelled');
  });

  it('passes a real failure through', async () => {
    const broken = authRepository({
      signInWithOAuth: async () => failure(new AppError('network', 'No connection.')),
    });

    const result = await new SignInWithGoogle(broken).execute();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('network');
  });
});

describe('SignOut', () => {
  it('clears local data on a successful sign-out', async () => {
    let cleared = false;
    const useCase = new SignOut(authRepository(), async () => {
      cleared = true;
    });

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    expect(cleared).toBe(true);
  });

  it('clears local data even when the server call fails', async () => {
    // The critical one. The member pressed sign out; their cached profile and
    // meets must not stay on the device because the network was down.
    let cleared = false;
    const offline = authRepository({
      signOut: async () => failure(new AppError('network', 'No connection.')),
    });

    const useCase = new SignOut(offline, async () => {
      cleared = true;
    });

    const result = await useCase.execute();

    expect(cleared).toBe(true);
    // Reported, not silent — but the local state is already clean.
    expect(result.ok).toBe(false);
  });
});
