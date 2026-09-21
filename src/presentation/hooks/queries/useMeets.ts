import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { useRepositories, useUseCases } from '@/app/di';
import type { Meet } from '@/domain/entities';
import { unwrap, type MeetRequest } from '@/domain/repositories';
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

export function useRequestMeet() {
  const { requestMeet } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: MeetRequest) => unwrap(await requestMeet.execute(request)),
    // Invalidate the whole `meets` prefix: a new meet changes the list and may
    // change a detail already in cache.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.meets.all }),
  });
}

export function useCancelMeet() {
  const { meets } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await meets.cancelMeet(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.meets.all }),
  });
}
