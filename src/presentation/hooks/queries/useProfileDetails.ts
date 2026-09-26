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

/**
 * Another member's common profile, as they have chosen to show it.
 *
 * Null when there is nothing to show — not verified, not finished onboarding,
 * or never filled in. Hidden answers and answers for any purpose other than
 * their current one never reach the phone: `profile_details_for()` removes
 * them on the server.
 */
export function useProfileDetailsFor(
  id: string | undefined,
): UseQueryResult<ProfileDetails | null, Error> {
  const { profileDetails } = useRepositories();

  return useQuery({
    queryKey: queryKeys.profileDetails.forPerson(id ?? ''),
    queryFn: async () => unwrap(await profileDetails.getDetailsFor(id as string)),
    enabled: Boolean(id),
  });
}
