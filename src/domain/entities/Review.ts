import type { MeetId } from './Meet';
import type { PersonId } from './Person';

/** A rating left after a meet. */

export type ReviewId = string;

/** Ratings are whole stars, one to five. Enforced when a review is created. */
export const MIN_RATING = 1;
export const MAX_RATING = 5;

export type Review = {
  id: ReviewId;
  meetId: MeetId;
  authorId: PersonId;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: Date;
};

export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= MIN_RATING && rating <= MAX_RATING;
}

/** Mean rating, or null when there is nothing to average. */
export function averageRating(reviews: Review[]): number | null {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return total / reviews.length;
}
