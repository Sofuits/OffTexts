import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { useRepositories, useUseCases } from '@/app/di';
import type { Review } from '@/domain/entities';
import { unwrap, type NewReview } from '@/domain/repositories';
import { queryKeys } from '@/shared/constants/queryKeys';

export function useReviewsForMeet(meetId: string | undefined): UseQueryResult<Review[], Error> {
  const { reviews } = useRepositories();

  return useQuery({
    queryKey: queryKeys.reviews.forMeet(meetId ?? ''),
    queryFn: async () => unwrap(await reviews.listReviewsForMeet(meetId as string)),
    enabled: Boolean(meetId),
  });
}

/**
 * Submits a review.
 *
 * Through the use case, because the length and rating rules belong to the
 * product rather than to the form. A validation failure arrives as an AppError
 * with `field` set, so the form can put the message against the right input.
 */
export function useSubmitReview() {
  const { submitReview } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (review: NewReview) => unwrap(await submitReview.execute(review)),
    onSuccess: (review) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forMeet(review.meetId) }),
  });
}
