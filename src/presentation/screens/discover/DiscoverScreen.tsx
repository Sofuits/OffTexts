import React, { useCallback } from 'react';

import {
  Badge,
  OfflineBanner,
  ProfileCard,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  Spacer,
} from '@/presentation/components';
import type { Person } from '@/domain/entities';
import { useDiscoverSuggestions } from '@/presentation/hooks';
import type { BottomTabScreenPropsFor } from '@/app/navigation/types';
import { selectDiscoverCityFilter, useUiStore } from '@/presentation/stores';

type Props = BottomTabScreenPropsFor<'Discover'>;

/**
 * Tab 2 — Discover, the centre tab and the app's landing screen.
 *
 * Worth reading as the example of how a screen is meant to look in this
 * codebase. It has no idea whether the people came from Supabase, from an
 * in-memory list, or from a future Go service: it calls a hook, the hook calls
 * a repository interface, and the composition root decided the rest.
 *
 * The city filter comes from Zustand because the server neither knows nor cares
 * about it; the people come from React Query because the server owns them.
 */
export function DiscoverScreen({ navigation }: Props): React.JSX.Element {
  const city = useUiStore(selectDiscoverCityFilter);
  const suggestions = useDiscoverSuggestions(city ? { city } : {});

  const openPerson = useCallback(
    (person: Person) =>
      navigation.navigate('PersonProfile', { personId: person.id, personName: person.name }),
    [navigation],
  );

  return (
    <ScreenContainer testID="screen-discover">
      <OfflineBanner />
      <ScreenHeader
        title="Discover"
        subtitle="People worth meeting this week"
        showLogo
        right={<Badge label={city ?? 'Pune'} tone="primary" />}
      />
      <Spacer size={24} />

      <QueryBoundary
        isLoading={suggestions.isPending}
        error={suggestions.error}
        data={suggestions.data}
        onRetry={suggestions.refetch}
        emptyMessage="No one new right now. Check back tomorrow."
      >
        {(people) =>
          people.map((person, index) => (
            <React.Fragment key={person.id}>
              {index > 0 ? <Spacer size={12} /> : null}
              <ProfileCard
                person={person}
                onPress={openPerson}
                testID={`card-person-${person.id}`}
              />
            </React.Fragment>
          ))
        }
      </QueryBoundary>
    </ScreenContainer>
  );
}
