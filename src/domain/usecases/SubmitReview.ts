import { isValidRating, MAX_RATING, MIN_RATING, type Review } from '@/domain/entities';
import {
  AppError,
  failure,
  type NewReview,
  type Result,
  type ReviewRepository,
} from '@/domain/repositories';

/**
 * Validates a review, then stores it.
 *
 * The rules live here rather than in the form because they are product rules,
 * not input formatting: the same limits must hold for a review arriving from
 * the website, from a future admin tool, or from a replayed offline mutation.
 * A form that validates is a convenience; this is the guarantee.
 */
export class SubmitReview {
  static readonly MIN_COMMENT_LENGTH = 10;
  static readonly MAX_COMMENT_LENGTH = 500;

  constructor(private readonly reviews: ReviewRepository) {}

  async execute(input: NewReview): Promise<Result<Review>> {
    if (!isValidRating(input.rating)) {
      return failure(
        new AppError('validation', `Choose between ${MIN_RATING} and ${MAX_RATING} stars.`, {
          field: 'rating',
        }),
      );
    }

    const comment = input.comment.trim();

    if (comment.length < SubmitReview.MIN_COMMENT_LENGTH) {
      return failure(
        new AppError(
          'validation',
          `Write at least ${SubmitReview.MIN_COMMENT_LENGTH} characters.`,
          { field: 'comment' },
        ),
      );
    }

    if (comment.length > SubmitReview.MAX_COMMENT_LENGTH) {
      return failure(
        new AppError('validation', `Keep it under ${SubmitReview.MAX_COMMENT_LENGTH} characters.`, {
          field: 'comment',
        }),
      );
    }

    return this.reviews.submitReview({ ...input, comment });
  }
}
