import type { MeetId, Review } from '@/domain/entities';
import type { Result } from './Result';

export type NewReview = {
  meetId: MeetId;
  /** Whole stars, 1 to 5. Validated before this is called. */
  rating: number;
  comment: string;
};

export interface ReviewRepository {
  listReviewsForMeet(meetId: MeetId): Promise<Result<Review[]>>;

  submitReview(review: NewReview): Promise<Result<Review>>;
}
