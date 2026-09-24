import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useRepositories, useUseCases } from '@/app/di';
import type { Meet, MeetId } from '@/domain/entities';
import { unwrap, type MeetingRequest } from '@/domain/repositories';
import type { ScheduledMeets } from '@/domain/usecases';
import { queryKeys } from '@/shared/constants/queryKeys';

/**
 * The member's meets, already split into upcoming and history.
 *
 * This one goes through a use case rather than straight to the repository,
 * because the split is a business rule the screen must not own — see
 * `GetScheduledMeets`.
 */
export function useScheduledMeets(): UseQueryResult<ScheduledMeets, Error> {
  const { getScheduledMeets } = useUseCases();

  return useQuery({
    queryKey: queryKeys.meets.scheduled(),
    queryFn: async () => unwrap(await getScheduledMeets.execute()),
  });
}

export function useMeet(id: string | undefined): UseQueryResult<Meet, Error> {
  const { meets } = useRepositories();

  return useQuery({
    queryKey: queryKeys.meets.detail(id ?? ''),
    queryFn: async () => unwrap(await meets.getMeetById(id as string)),
    enabled: Boolean(id),
  });
}

/**
 * Books a table.
 *
 * Resolves to the new meeting's id, not to the meeting. The server writes the
 * fee as quoted at that instant and copies the café's name and area down by
 * trigger, so the only truthful thing to return is a handle — the detail screen
 * then reads the row that exists rather than one assembled on the phone.
 */
export function useRequestMeet(): UseMutationResult<MeetId, Error, MeetingRequest> {
  const { requestMeet } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: MeetingRequest) => unwrap(await requestMeet.execute(request)),
    onSuccess: () => {
      // Invalidate the whole `meets` prefix: a new meet changes the list and
      // may change a detail already in cache.
      void queryClient.invalidateQueries({ queryKey: queryKeys.meets.all });
      // And the match it came from now shows a meeting count.
      void queryClient.invalidateQueries({ queryKey: queryKeys.matching.matches() });
    },
  });
}

export function useCancelMeet(): UseMutationResult<Meet, Error, string> {
  const { meets } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await meets.cancelMeet(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meets.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.matching.matches() });
    },
  });
}
