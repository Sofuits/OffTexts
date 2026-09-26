import { ProfileLocalDataSource } from '@/data/datasources/local';
import type { Person } from '@/domain/entities';
import type { Logger } from '@/infrastructure/logging';
import { InMemoryStore } from '@/infrastructure/storage';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';

const silent: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  captureException: () => {},
  setUser: () => {},
};

const PERSON: Person = {
  id: 'person-1',
  name: 'Saksham',
  headline: '',
  city: 'Pune',
  photoUrls: [],
  interests: [],
  intents: ['dating'],
  verification: 'verified',
  onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
};

describe('ProfileLocalDataSource', () => {
  it('reads back what it wrote', async () => {
    const cache = new ProfileLocalDataSource(new InMemoryStore(), silent);

    await cache.write(PERSON);

    expect(await cache.read()).toEqual(PERSON);
  });

  it('discards a profile cached by an older build instead of serving it', async () => {
    const store = new InMemoryStore();
    // What builds before the onboarding change wrote: a bare Person, with no
    // onboardingCompletedAt. Served offline, it would send a finished member
    // back through onboarding.
    const { onboardingCompletedAt: _dropped, ...legacy } = PERSON;
    await store.setItem(STORAGE_KEYS.cachedProfile, JSON.stringify(legacy));
    const cache = new ProfileLocalDataSource(store, silent);

    expect(await cache.read()).toBeNull();
    expect(await store.getItem(STORAGE_KEYS.cachedProfile)).toBeNull();
  });
});
