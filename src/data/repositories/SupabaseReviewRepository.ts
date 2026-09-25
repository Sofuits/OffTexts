import type { Review } from '@/domain/entities';
import {
  AppError,
  attempt,
  type NewReview,
  type Result,
  type ReviewRepository,
} from '@/domain/repositories';
import { toReview, type ReviewRowWithAuthor } from '@/data/mappers';
import { classifySupabaseError } from '@/infrastructure/supabase/supabaseErrors';
import type { TypedSupabaseClient } from '@/infrastructure/supabase/supabaseClient';

/**
 * Reviews on Supabase.
 *
 * Validation is not repeated here — `SubmitReview` in the domain owns it. What
 * this layer does rely on is a database constraint (`rating between 1 and 5`)
 * and an RLS policy restricting inserts to participants of the meet. Client
 * validation is a courtesy; the database is the guarantee, because a determined
 * caller can talk to PostgREST without going through this app at all.
 */
export class SupabaseReviewRepository implements ReviewRepository {
  constructor(private readonly client: TypedSupabaseClient) {}

  async listReviewsForMeet(meetId: string): Promise<Result<Review[]>> {
    return attempt(async () => {
      const { data, error } = await this.client
        .from('reviews')
        .select('*, author:profiles!reviews_author_id_fkey(name)')
        .eq('meet_id', meetId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as unknown as ReviewRowWithAuthor[]).map(toReview);
    }, classifySupabaseError);
  }

  async submitReview(input: NewReview): Promise<Result<Review>> {
    return attempt(async () => {
      const { data: auth } = await this.client.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new AppError('unauthenticated', 'You are not signed in.');

      const { data, error } = await this.client
        .from('reviews')
        .insert({
          meet_id: input.meetId,
          author_id: userId,
          rating: input.rating,
          comment: input.comment,
        })
        .select('*')
        .single();

      if (error) throw error;
      return toReview(data as unknown as ReviewRowWithAuthor);
    }, classifySupabaseError);
  }
}
