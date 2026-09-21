import type { Person } from '@/domain/entities';
import type { KeyValueStore } from '@/infrastructure/storage';
import type { Logger } from '@/infrastructure/logging';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';

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
      return JSON.parse(raw) as Person;
    } catch (error) {
      // Written by an older version in a shape we no longer parse. Drop it.
      this.logger.warn('Cached profile could not be parsed; discarding.', { error });
      await this.store.removeItem(STORAGE_KEYS.cachedProfile);
      return null;
    }
  }

  async write(person: Person): Promise<void> {
    await this.store.setItem(STORAGE_KEYS.cachedProfile, JSON.stringify(person));
  }

  async clear(): Promise<void> {
    await this.store.removeItem(STORAGE_KEYS.cachedProfile);
  }
}
