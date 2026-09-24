import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { useRepositories, useUseCases } from '@/app/di';
import type { Person } from '@/domain/entities';
import { unwrap, type ProfileUpdate } from '@/domain/repositories';
import { queryKeys } from '@/shared/constants/queryKeys';

/**
 * The signed-in member's profile.
 *
 * Note what this hook does NOT contain: no Supabase, no table name, no SQL.
 * It asks a repository — an interface — and React Query handles caching. That
 * is the whole contract between the UI and the backend.
 *
 * `unwrap` converts our Result into a throw, because React Query's `error`
 * state, retry logic and error boundaries are all built around exceptions. The
 * Result type did its job at the layer where a caller might have forgotten to
 * check; here, React Query cannot forget.
 */
export function useMyProfile(): UseQueryResult<Person, Error> {
  const { profile } = useRepositories();

  return useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: async () => unwrap(await profile.getMyProfile()),
  });
}

export function useProfileById(id: string | undefined): UseQueryResult<Person, Error> {
  const { profile } = useRepositories();

  return useQuery({
    queryKey: queryKeys.profile.byId(id ?? ''),
    queryFn: async () => unwrap(await profile.getProfileById(id as string)),
    // Without this, navigating to a detail screen before the id resolves fires
    // a request for an empty string.
    enabled: Boolean(id),
  });
}

export function useUpdateMyProfile() {
  const { profile } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: ProfileUpdate) => unwrap(await profile.updateMyProfile(update)),
    onSuccess: (updated) => {
      // Seed the cache from the response instead of refetching: the server has
      // already told us the new state, and a refetch is a second round trip the
      // member watches.
      queryClient.setQueryData(queryKeys.profile.me(), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.byId(updated.id) });
    },
  });
}

/**
 * Sends the signed-in member back to the onboarding wizard. Development only.
 *
 * Invalidates rather than seeding the cache from the response. `AuthedArea`
 * decides between the wizard and the tabs from `profile.me()`, and a refetch
 * is the same path a real first run takes — which is the thing being tested.
 */
export function useResetOnboarding() {
  const { resetOnboarding } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => unwrap(await resetOnboarding.execute()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.photos.mine() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
    },
  });
}
