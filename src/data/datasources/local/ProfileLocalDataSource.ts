import type { Person } from '@/domain/entities';
import type { KeyValueStore } from '@/infrastructure/storage';
import type { Logger } from '@/infrastructure/logging';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';

/**
 * Bumped whenever `Person` gains a field the app makes a decision with, so a
 * copy cached by an older build is discarded rather than trusted.
 *
 * 2: `onboardingCompletedAt` (migration 0012).
 */
const CACHE_VERSION = 2;

type CachedProfile = { version: number; person: Person };

/**
 * The last profile we successfully fetched, kept on disk.
 *
 * This is what makes the Profile tab useful on a train with no signal: the
 * repository returns the cached copy instead of an error, and the UI shows it
 * with an "offline" note rather than an empty screen.
 *
 * Dates are the trap in any JSON cache — `JSON.parse` gives back a string where
 * a Date went in. `Person` happens to contain none, which is why it is cached
 * as-is; `Meet` does, so its local source revives them explicitly.
 */
export class ProfileLocalDataSource {
  constructor(
    private readonly store: KeyValueStore,
    private readonly logger: Logger,
  ) {}

  async read(): Promise<Person | null> {
    const raw = await this.store.getItem(STORAGE_KEYS.cachedProfile);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<CachedProfile>;
      if (parsed.version !== CACHE_VERSION || !parsed.person) {
        // Written by an older build. Its profile predates fields the app now
        // decides things with — onboarding completion, for one — and serving
        // it would send a finished member back through onboarding the first
        // time they open the new build offline. Better no cache than that.
        await this.store.removeItem(STORAGE_KEYS.cachedProfile);
        return null;
      }
      return parsed.person;
    } catch (error) {
      // Not JSON at all. Drop it.
      this.logger.warn('Cached profile could not be parsed; discarding.', { error });
      await this.store.removeItem(STORAGE_KEYS.cachedProfile);
      return null;
    }
  }

  async write(person: Person): Promise<void> {
    const cached: CachedProfile = { version: CACHE_VERSION, person };
    await this.store.setItem(STORAGE_KEYS.cachedProfile, JSON.stringify(cached));
  }

  async clear(): Promise<void> {
    await this.store.removeItem(STORAGE_KEYS.cachedProfile);
  }
}
