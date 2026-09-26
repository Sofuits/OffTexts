import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useRepositories } from '@/app/di';
import type { ProfileDetails } from '@/domain/entities';
import { unwrap } from '@/domain/repositories';
import { queryKeys } from '@/shared/constants/queryKeys';

/**
 * The signed-in member's common profile — education, work, lifestyle,
 * prompts — including the answers they have hidden from everybody else.
 *
 * Never `null`: a member who has not saved anything yet gets the empty
 * profile, which is what the onboarding flow starts from.
 */
export function useMyProfileDetails(): UseQueryResult<ProfileDetails, Error> {
  const { profileDetails } = useRepositories();

  return useQuery({
    queryKey: queryKeys.profileDetails.mine(),
    queryFn: async () => unwrap(await profileDetails.getMyDetails()),
  });
}
