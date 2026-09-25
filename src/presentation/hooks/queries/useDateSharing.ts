import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useRepositories } from '@/app/di';
import type { DayKey, OtherMemberDates } from '@/domain/entities';
import { unwrap } from '@/domain/repositories';
import { queryKeys } from '@/shared/constants/queryKeys';

/**
 * The other member's dates, for the dates I marked on the calendar.
 *
 * Asked once, with the dates I arrived with, and not again as I tick and
 * untick my own column on the shared table — their answer should not shift
 * under me while I edit mine. Placeholder data for now; see
 * DateSharingRepository.
 */
export function useTheirDates(mine: DayKey[]): UseQueryResult<OtherMemberDates, Error> {
  const { dateSharing } = useRepositories();

  return useQuery({
    queryKey: queryKeys.dateSharing.theirs(mine),
    queryFn: async () => unwrap(await dateSharing.theirDates(mine)),
  });
}
