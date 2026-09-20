import type { Meet } from '@/domain/entities';
import type { Logger } from '@/infrastructure/logging';
import type { KeyValueStore } from '@/infrastructure/storage';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';

/**
 * The member's meets, cached on disk for offline reads.
 *
 * `scheduledFor` is a Date. JSON has no date type, so it goes out as a string
 * and must be revived on the way back in — miss that and `isUpcoming` calls
 * `.getTime()` on a string and the Meets tab crashes. That is the same class of
 * bug as the Intl one: invisible in a type-checked codebase because
 * `JSON.parse` returns `any`.
 */
type SerialisedMeet = Omit<Meet, 'scheduledFor'> & { scheduledFor: string };

export class MeetLocalDataSource {
  constructor(
    private readonly store: KeyValueStore,
    private readonly logger: Logger,
  ) {}

  async read(): Promise<Meet[] | null> {
    const raw = await this.store.getItem(STORAGE_KEYS.cachedMeets);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as SerialisedMeet[];
      return (
        parsed
          .map((meet) => ({ ...meet, scheduledFor: new Date(meet.scheduledFor) }))
          // A corrupt timestamp would poison every sort and comparison downstream.
          .filter((meet) => !Number.isNaN(meet.scheduledFor.getTime()))
      );
    } catch (error) {
      this.logger.warn('Cached meets could not be parsed; discarding.', { error });
      await this.store.removeItem(STORAGE_KEYS.cachedMeets);
      return null;
    }
  }

  async write(meets: Meet[]): Promise<void> {
    const serialised: SerialisedMeet[] = meets.map((meet) => ({
      ...meet,
      scheduledFor: meet.scheduledFor.toISOString(),
    }));
    await this.store.setItem(STORAGE_KEYS.cachedMeets, JSON.stringify(serialised));
  }

  async clear(): Promise<void> {
    await this.store.removeItem(STORAGE_KEYS.cachedMeets);
  }
}
