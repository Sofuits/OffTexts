import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useRepositories } from '@/app/di';
import type { Preferences, PreferencesUpdate } from '@/domain/entities';
import { unwrap } from '@/domain/repositories';
import { queryKeys } from '@/shared/constants/queryKeys';

/**
 * What the member wants to be shown.
 *
 * There is exactly one row per member and the signup trigger creates it, so
 * this never has to answer "not set up yet" — see the comment on `Preferences`.
 * That is why there is no `enabled` guard and no null branch anywhere that
 * reads this.
 */
export function useMyPreferences(): UseQueryResult<Preferences, Error> {
  const { preferences } = useRepositories();

  return useQuery({
    queryKey: queryKeys.preferences.mine(),
    queryFn: async () => unwrap(await preferences.getMyPreferences()),
  });
}

export function useUpdateMyPreferences(): UseMutationResult<Preferences, Error, PreferencesUpdate> {
  const { preferences } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: PreferencesUpdate) =>
      unwrap(await preferences.updateMyPreferences(update)),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.preferences.mine(), updated);
      // Who you are shown depends on these, so today's set is now suspect.
      void queryClient.invalidateQueries({ queryKey: queryKeys.matching.all });
    },
  });
}
