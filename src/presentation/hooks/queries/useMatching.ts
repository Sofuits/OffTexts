import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useRepositories } from '@/app/di';
import type {
  CandidateId,
  CandidateSet,
  DecisionKind,
  DecisionOutcome,
  Match,
  PersonId,
} from '@/domain/entities';
import { unwrap } from '@/domain/repositories';
import { queryKeys } from '@/shared/constants/queryKeys';

/**
 * Today's three people.
 *
 * `staleTime` is long because the set genuinely does not change during the day
 * — the database builds it once, overnight. Refetching it on every focus would
 * be three round trips an hour to be told the same thing.
 *
 * It is not `Infinity`, though: the set rolls over at midnight, and a phone
 * left open overnight should pick up tomorrow's people rather than showing
 * yesterday's for ever.
 */
export function useTodaysCandidates(): UseQueryResult<CandidateSet, Error> {
  const { matching } = useRepositories();

  return useQuery({
    queryKey: queryKeys.matching.today(),
    queryFn: async () => unwrap(await matching.getTodaysCandidates()),
    staleTime: 15 * 60 * 1000,
  });
}

export type RecordDecisionInput = {
  subjectId: PersonId;
  kind: DecisionKind;
  candidateId?: CandidateId;
};

/**
 * Like or pass.
 *
 * Optimistic, and deliberately so. The member has already decided; making them
 * watch a spinner to be told what they just chose is the difference between a
 * flow that moves and one that stutters. `onMutate` writes the decision into
 * the cached set, `onError` puts the old set back, and `onSettled` asks the
 * server who is right.
 *
 * The match, when there is one, is NOT optimistic. It comes from the server's
 * reply, because only the database knows whether the other person liked you —
 * and guessing that wrong would be the worst possible thing to guess wrong.
 */
export function useRecordDecision(): UseMutationResult<
  DecisionOutcome,
  Error,
  RecordDecisionInput,
  { previous: CandidateSet | undefined }
> {
  const { matching } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subjectId, kind, candidateId }: RecordDecisionInput) =>
      unwrap(await matching.recordDecision(subjectId, kind, candidateId)),

    onMutate: async ({ subjectId, kind }) => {
      // Without this, an in-flight refetch can land after the optimistic write
      // and overwrite it with the pre-decision state.
      await queryClient.cancelQueries({ queryKey: queryKeys.matching.today() });

      const previous = queryClient.getQueryData<CandidateSet>(queryKeys.matching.today());

      if (previous) {
        queryClient.setQueryData<CandidateSet>(queryKeys.matching.today(), {
          ...previous,
          candidates: previous.candidates.map((candidate) =>
            candidate.person.id === subjectId ? { ...candidate, myDecision: kind } : candidate,
          ),
        });
      }

      return { previous };
    },

    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.matching.today(), context.previous);
      }
    },

    onSuccess: (outcome) => {
      // A match changes the Meets tab, so invalidate it — but only when there
      // is one. Most decisions produce nothing and should cost nothing.
      if (outcome.match) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.matching.matches() });
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.matching.today() });
    },
  });
}

export function useMatches(): UseQueryResult<Match[], Error> {
  const { matching } = useRepositories();

  return useQuery({
    queryKey: queryKeys.matching.matches(),
    queryFn: async () => unwrap(await matching.listMatches()),
  });
}

export function useCloseMatch(): UseMutationResult<void, Error, { id: string; reason?: string }> {
  const { matching } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }) => unwrap(await matching.closeMatch(id, reason)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.matching.matches() });
    },
  });
}
