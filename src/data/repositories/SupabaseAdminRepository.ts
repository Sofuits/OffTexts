import {
  AppError,
  attempt,
  type AdminCounts,
  type AdminRepository,
  type MemberFilter,
  type MemberRecord,
  type Page,
  type ReservationRecord,
  type Result,
  type ReviewRecord,
} from '@/domain/repositories';
import type { Person, PersonId, VerificationStatus } from '@/domain/entities';
import { toPerson } from '@/data/mappers';
import { classifySupabaseError } from '@/infrastructure/supabase/supabaseErrors';
import type { TypedSupabaseClient } from '@/infrastructure/supabase/supabaseClient';

/**
 * The admin portal's data access.
 *
 * Every query here reads across the whole table, and every one of them returns
 * nothing at all unless `public.is_staff()` says the caller is staff. That is
 * not defensive coding in this file — there is none. The policies in migration
 * 0003 are the control, and they apply to anyone holding the session, whether
 * they arrive through the portal or through curl.
 *
 * Which is the point worth understanding: this class cannot grant itself
 * access. Delete every line of it and the database is exactly as safe.
 */
export class SupabaseAdminRepository implements AdminRepository {
  /** Whatever a caller asks for, the browser is not rendering more than this. */
  private static readonly MAX_LIMIT = 200;

  constructor(private readonly client: TypedSupabaseClient) {}

  async amIStaff(): Promise<Result<boolean>> {
    return attempt(async () => {
      const { data, error } = await this.client.rpc('is_staff');
      if (error) throw error;
      return data === true;
    }, classifySupabaseError);
  }

  async listMembers(filter: MemberFilter = {}): Promise<Result<Page<MemberRecord>>> {
    return attempt(async () => {
      const limit = Math.min(filter.limit ?? 50, SupabaseAdminRepository.MAX_LIMIT);

      let builder = this.client
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        // One extra row: if it comes back, there is another page. Cheaper and
        // more honest than a count query, which would be a second round trip
        // to answer a question the rows already answer.
        .limit(limit + 1);

      if (filter.verification) builder = builder.eq('verification', filter.verification);
      if (filter.city) builder = builder.eq('city', filter.city);
      if (filter.cursor) builder = builder.lt('created_at', filter.cursor);

      if (filter.search) {
        // Escape the PostgREST `or` separators before interpolating. A comma or
        // a parenthesis in someone's search text would otherwise be read as
        // filter syntax rather than as text.
        const term = filter.search.replace(/[,()]/g, ' ').trim();
        if (term) builder = builder.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
      }

      const { data, error } = await builder;
      if (error) throw error;

      const hasMore = data.length > limit;
      const rows = hasMore ? data.slice(0, limit) : data;
      const last = rows[rows.length - 1];

      return {
        items: rows.map((row) => ({ person: toPerson(row), joinedAt: new Date(row.created_at) })),
        nextCursor: hasMore && last ? last.created_at : null,
      };
    }, classifySupabaseError);
  }

  async setVerification(id: PersonId, status: VerificationStatus): Promise<Result<Person>> {
    return attempt(async () => {
      const { data, error } = await this.client
        .from('profiles')
        .update({ verification: status })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      // A staff policy that silently matched no rows would return null here
      // rather than an error, and the UI would show a success it did not get.
      if (!data) throw new AppError('forbidden', 'That profile could not be updated.');
      return toPerson(data);
    }, classifySupabaseError);
  }

  async listReservations(limit = 100): Promise<Result<ReservationRecord[]>> {
    return attempt(async () => {
      // Two embedded joins on the same table, disambiguated by the foreign key
      // name. Without `!meets_requester_id_fkey` PostgREST cannot tell which
      // relationship is meant and refuses the query.
      const { data, error } = await this.client
        .from('meets')
        .select(
          'id, venue_name, venue_area, scheduled_for, status, requester_id, recipient_id, ' +
            'requester:profiles!meets_requester_id_fkey(name), ' +
            'recipient:profiles!meets_recipient_id_fkey(name)',
        )
        .order('scheduled_for', { ascending: false })
        .limit(Math.min(limit, SupabaseAdminRepository.MAX_LIMIT));

      if (error) throw error;

      type Row = {
        id: string;
        venue_name: string;
        venue_area: string;
        scheduled_for: string;
        status: ReservationRecord['status'];
        requester_id: string;
        recipient_id: string;
        requester: { name: string } | null;
        recipient: { name: string } | null;
      };

      return (data as unknown as Row[]).map((row) => ({
        id: row.id,
        requesterId: row.requester_id,
        requesterName: row.requester?.name ?? 'Unknown member',
        recipientId: row.recipient_id,
        recipientName: row.recipient?.name ?? 'Unknown member',
        venueName: row.venue_name,
        venueArea: row.venue_area,
        scheduledFor: new Date(row.scheduled_for),
        status: row.status,
      }));
    }, classifySupabaseError);
  }

  async listReviews(limit = 100): Promise<Result<ReviewRecord[]>> {
    return attempt(async () => {
      const { data, error } = await this.client
        .from('reviews')
        .select(
          'id, meet_id, author_id, rating, comment, created_at, ' +
            'author:profiles!reviews_author_id_fkey(name), ' +
            'meet:meets!reviews_meet_id_fkey(scheduled_for)',
        )
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, SupabaseAdminRepository.MAX_LIMIT));

      if (error) throw error;

      type Row = {
        id: string;
        meet_id: string;
        author_id: string;
        rating: number;
        comment: string;
        created_at: string;
        author: { name: string } | null;
        meet: { scheduled_for: string } | null;
      };

      return (data as unknown as Row[]).map((row) => ({
        review: {
          id: row.id,
          meetId: row.meet_id,
          authorId: row.author_id,
          authorName: row.author?.name ?? 'Unknown member',
          rating: row.rating,
          comment: row.comment,
          createdAt: new Date(row.created_at),
        },
        meetScheduledFor: new Date(row.meet?.scheduled_for ?? row.created_at),
      }));
    }, classifySupabaseError);
  }

  async getCounts(): Promise<Result<AdminCounts>> {
    return attempt(async () => {
      // `head: true` asks for the count and no rows, so four numbers cost four
      // empty responses rather than four full table reads. In parallel, because
      // they do not depend on each other and the portal is a page load away.
      const [members, verified, reservations, reviews] = await Promise.all([
        this.client.from('profiles').select('*', { count: 'exact', head: true }),
        this.client
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('verification', 'verified'),
        this.client.from('meets').select('*', { count: 'exact', head: true }),
        this.client.from('reviews').select('*', { count: 'exact', head: true }),
      ]);

      for (const result of [members, verified, reservations, reviews]) {
        if (result.error) throw result.error;
      }

      return {
        members: members.count ?? 0,
        verifiedMembers: verified.count ?? 0,
        reservations: reservations.count ?? 0,
        reviews: reviews.count ?? 0,
      };
    }, classifySupabaseError);
  }
}
