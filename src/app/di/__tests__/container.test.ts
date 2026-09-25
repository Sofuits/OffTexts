import { createTestContainer } from '@/app/di';
import { InMemoryAuthRepository, InMemoryDiscoverRepository } from '@/data/repositories';
import { AppError, failure, type DiscoverRepository } from '@/domain/repositories';

/**
 * The composition root.
 *
 * These assertions are about the promise the architecture makes: that the whole
 * dependency graph is decided in one file, and that swapping any part of it is
 * a single line.
 */
describe('container', () => {
  it('wires in-memory repositories when no backend is configured', () => {
    const container = createTestContainer();

    expect(container.backend).toBe('in-memory');
    // A working app with no account on anything — this is what makes a fresh
    // clone runnable in two minutes.
    expect(container.repositories.discover).toBeInstanceOf(InMemoryDiscoverRepository);
  });

  it('builds every use case from the same repositories it exposes', async () => {
    const container = createTestContainer();

    const viaUseCase = await container.useCases.getScheduledMeets.execute();
    const viaRepository = await container.repositories.meets.listMeets();

    expect(viaUseCase.ok).toBe(true);
    expect(viaRepository.ok).toBe(true);
    if (!viaUseCase.ok || !viaRepository.ok) return;

    // Same underlying data: the use case must not have been handed a second,
    // separate repository instance.
    const total = viaUseCase.value.upcoming.length + viaUseCase.value.history.length;
    expect(total).toBe(viaRepository.value.length);
  });

  it('lets a single repository be replaced without touching the rest', async () => {
    const stub: DiscoverRepository = {
      getSuggestions: async () => failure(new AppError('server', 'Deliberate failure.')),
    };

    const container = createTestContainer({ repositories: { discover: stub } });

    const discover = await container.repositories.discover.getSuggestions();
    expect(discover.ok).toBe(false);

    // Everything else is untouched.
    const meets = await container.repositories.meets.listMeets();
    expect(meets.ok).toBe(true);
  });

  it('seeds the in-memory repositories with usable data', async () => {
    const container = createTestContainer();

    const profile = await container.repositories.profile.getMyProfile();
    const suggestions = await container.repositories.discover.getSuggestions();

    expect(profile.ok).toBe(true);
    expect(suggestions.ok).toBe(true);
    if (!suggestions.ok) return;
    expect(suggestions.value.people.length).toBeGreaterThan(0);
  });

  it('exposes services, so nothing has to construct a logger for itself', () => {
    const container = createTestContainer();

    expect(container.services.logger).toBeDefined();
    expect(container.services.analytics).toBeDefined();
    expect(container.services.connectivity).toBeDefined();
  });

  it('can start already signed in, so screens can be built before auth is configured', async () => {
    // Default: signed out, so the gate is exercised the way a real member meets it.
    const gated = new InMemoryAuthRepository();
    const gatedSession = await gated.getSession();
    expect(gatedSession.ok).toBe(true);
    if (gatedSession.ok) expect(gatedSession.value).toBeNull();

    // env.devSkipAuth: the repository reports a session from the first frame.
    // Nothing in the navigator or the gate changes — they believe the
    // repository, which is the whole reason it is an interface.
    const bypassed = new InMemoryAuthRepository({ startSignedIn: true });
    let observed: string | undefined;
    const stop = bypassed.observeAuthState((state) => {
      observed = state.status;
    });
    stop();
    expect(observed).toBe('signedIn');
  });

  it('only shows verified members in Discover', async () => {
    // Business rule enforced by the in-memory repository the same way the
    // Supabase one enforces it with `.eq('verification', 'verified')`.
    const container = createTestContainer();
    const result = await container.repositories.discover.getSuggestions();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.people.every((person) => person.verification === 'verified')).toBe(true);
  });
});
