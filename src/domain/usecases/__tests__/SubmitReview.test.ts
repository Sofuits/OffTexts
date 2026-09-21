import type { Review } from '@/domain/entities';
import { AppError, failure, success, type ReviewRepository } from '@/domain/repositories';
import { SubmitReview } from '@/domain/usecases';

const VALID_COMMENT = 'Turned up on time and was easy to talk to.';

function repositoryCapturing(): {
  repository: ReviewRepository;
  lastComment: () => string | null;
  callCount: () => number;
} {
  let lastComment: string | null = null;
  let calls = 0;

  const repository: ReviewRepository = {
    listReviewsForMeet: async () => failure(new AppError('notFound', 'not used')),
    submitReview: async (input) => {
      calls += 1;
      lastComment = input.comment;
      const review: Review = {
        id: 'review-1',
        meetId: input.meetId,
        authorId: 'person-0',
        authorName: 'You',
        rating: input.rating,
        comment: input.comment,
        createdAt: new Date(),
      };
      return success(review);
    },
  };

  return { repository, lastComment: () => lastComment, callCount: () => calls };
}

describe('SubmitReview', () => {
  it('accepts a valid review', async () => {
    const { repository } = repositoryCapturing();
    const result = await new SubmitReview(repository).execute({
      meetId: 'meet-1',
      rating: 5,
      comment: VALID_COMMENT,
    });

    expect(result.ok).toBe(true);
  });

  it.each([0, 6, 2.5, -1, Number.NaN])('rejects the rating %p', async (rating) => {
    const { repository, callCount } = repositoryCapturing();
    const result = await new SubmitReview(repository).execute({
      meetId: 'meet-1',
      rating,
      comment: VALID_COMMENT,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation');
    // The field name is what lets a form put the message on the right input.
    expect(result.error.field).toBe('rating');
    // Nothing reached the repository: invalid input must not cost a round trip.
    expect(callCount()).toBe(0);
  });

  it('rejects a comment that is too short', async () => {
    const { repository } = repositoryCapturing();
    const result = await new SubmitReview(repository).execute({
      meetId: 'meet-1',
      rating: 4,
      comment: 'ok',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe('comment');
  });

  it('counts length after trimming, so whitespace cannot pass the minimum', async () => {
    const { repository } = repositoryCapturing();
    const result = await new SubmitReview(repository).execute({
      meetId: 'meet-1',
      rating: 4,
      comment: '   ok   ',
    });

    expect(result.ok).toBe(false);
  });

  it('stores the trimmed comment, not the raw one', async () => {
    const { repository, lastComment } = repositoryCapturing();
    await new SubmitReview(repository).execute({
      meetId: 'meet-1',
      rating: 4,
      comment: `  ${VALID_COMMENT}  `,
    });

    expect(lastComment()).toBe(VALID_COMMENT);
  });

  it('rejects a comment over the maximum', async () => {
    const { repository } = repositoryCapturing();
    const result = await new SubmitReview(repository).execute({
      meetId: 'meet-1',
      rating: 4,
      comment: 'a'.repeat(SubmitReview.MAX_COMMENT_LENGTH + 1),
    });

    expect(result.ok).toBe(false);
  });
});
