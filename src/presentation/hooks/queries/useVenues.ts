import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useRepositories } from '@/app/di';
import type { Venue } from '@/domain/entities';
import { unwrap } from '@/domain/repositories';
import { queryKeys } from '@/shared/constants/queryKeys';

export type VenueQueryOptions = {
  /**
   * Hold the request until the city is known.
   *
   * Without it, a screen that reads the city from the profile fires once with
   * no city — fetching every café in the country — and again a moment later
   * with one. The member watches a list of cafés in another city appear and
   * then be replaced, which looks like a bug and is two requests.
   */
  enabled?: boolean;
};

/**
 * Partner cafés, optionally in one city.
 *
 * Cached for an hour. A café's address and opening hours change a few times a
 * year at most, and the booking screen re-reads this every time somebody
 * changes the day they want — without a long `staleTime` that is a round trip
 * per tap.
 */
export function useVenues(
  city?: string,
  options: VenueQueryOptions = {},
): UseQueryResult<Venue[], Error> {
  const { venues } = useRepositories();

  return useQuery({
    queryKey: queryKeys.venues.list(city),
    queryFn: async () => unwrap(await venues.listVenues(city)),
    staleTime: 60 * 60 * 1000,
    enabled: options.enabled ?? true,
  });
}
