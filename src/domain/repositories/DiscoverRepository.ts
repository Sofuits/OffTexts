import type { MeetIntent, Person } from '@/domain/entities';
import type { Result } from './Result';

export type DiscoverQuery = {
  city?: string;
  intents?: MeetIntent[];
  /** How many to return. The data layer clamps this to a sane maximum. */
  limit?: number;
  /** Opaque token from a previous page. Absent means the first page. */
  cursor?: string;
};

export type DiscoverPage = {
  people: Person[];
  /** Pass back as `cursor` for the next page. Null when there are no more. */
  nextCursor: string | null;
};

/** People a member could meet. */
export interface DiscoverRepository {
  getSuggestions(query?: DiscoverQuery): Promise<Result<DiscoverPage>>;
}
