import type { Review } from '@/domain/entities';
import type { ReviewRow } from '@/infrastructure/supabase';

export type ReviewRowWithAuthor = ReviewRow & {
  /** Joined from `profiles`. */
  author_name?: string;
};

export function toReview(row: ReviewRowWithAuthor): Review {
  return {
    id: row.id,
    meetId: row.meet_id,
    authorId: row.author_id,
    authorName: row.author_name ?? 'Member',
    rating: row.rating,
    comment: row.comment,
    createdAt: new Date(row.created_at),
  };
}
