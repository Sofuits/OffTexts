import {
  AppError,
  attempt,
  type DiscoverPage,
  type DiscoverQuery,
  type DiscoverRepository,
  type Result,
} from '@/domain/repositories';
import { toPerson } from '@/data/mappers';
import { classifySupabaseError, type TypedSupabaseClient } from '@/infrastructure/supabase';

/**
 * Discover suggestions on Supabase.
 *
 * Paged by a keyset cursor (`created_at`) rather than by offset. Offset paging
 * on a feed that is being written to shows duplicates and skips rows as the
 * underlying set shifts between requests; a cursor does not.
 *
 * The `.neq('id', …)` is what stops a member being suggested to themselves.
 * It reads like a detail and is the first bug QA files without it.
 */
export class SupabaseDiscoverRepository implements DiscoverRepository {
  /** Hard ceiling, whatever a caller asks for. Protects the device and the bill. */
  private static readonly MAX_LIMIT = 50;

  constructor(private readonly client: TypedSupabaseClient) {}

  async getSuggestions(query: DiscoverQuery = {}): Promise<Result<DiscoverPage>> {
    return attempt(async () => {
      const { data: auth } = await this.client.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new AppError('unauthenticated', 'You are not signed in.');

      const limit = Math.min(query.limit ?? 20, SupabaseDiscoverRepository.MAX_LIMIT);

      let builder = this.client
        .from('profiles')
        .select('*')
        .eq('verification', 'verified')
        .neq('id', userId)
        .order('created_at', { ascending: false })
        // One extra row: if it comes back, there is another page.
        .limit(limit + 1);

      if (query.city) builder = builder.eq('city', query.city);
      if (query.intents?.length) builder = builder.overlaps('intents', query.intents);
      if (query.cursor) builder = builder.lt('created_at', query.cursor);

      const { data, error } = await builder;
      if (error) throw error;

      const hasMore = data.length > limit;
      const rows = hasMore ? data.slice(0, limit) : data;
      const last = rows[rows.length - 1];

      return {
        people: rows.map(toPerson),
        nextCursor: hasMore && last ? last.created_at : null,
      };
    }, classifySupabaseError);
  }
}
