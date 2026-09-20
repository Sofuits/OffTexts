import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useRepositories } from '@/app/di';
import type { Person } from '@/domain/entities';
import { unwrap, type DiscoverQuery } from '@/domain/repositories';
import { queryKeys } from '@/shared/constants/queryKeys';

/**
 * People to meet.
 *
 * A plain query rather than `useInfiniteQuery` while Discover shows a short
 * daily set. The repository already returns a cursor, so moving to infinite
 * scrolling later is a change in this hook and the screen — not in the data
 * layer, and not in the backend.
 */
export function useDiscoverSuggestions(query: DiscoverQuery = {}): UseQueryResult<Person[], Error> {
  const { discover } = useRepositories();

  return useQuery({
    queryKey: queryKeys.discover.suggestions(query.city),
    queryFn: async () => {
      const page = unwrap(await discover.getSuggestions(query));
      return page.people;
    },
  });
}
