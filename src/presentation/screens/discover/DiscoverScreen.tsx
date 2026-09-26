import React, { useCallback } from 'react';

import {
  AppText,
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
import type { RootStackScreenProps } from '@/app/navigation/types';
import { selectDiscoverCityFilter, useUiStore } from '@/presentation/stores';

type Props = RootStackScreenProps<'Browse'>;

/**
 * Everybody, rather than today's three.
 *
 * NOT A TAB, AND THAT IS THE POINT. The product is three people a day, chosen
 * — a browsable list sitting next to it in the tab bar would undo that the
 * first time somebody reached the end of a set. It lives one level down, off
 * the profile screen, where a member goes when they want to do something other
 * than the main loop.
 *
 * There is no like button here either. Liking is a decision about one of
 * today's candidates, recorded against a candidate row; there is nothing to
 * record a like against for somebody the algorithm has not offered you. So
 * this browses and nothing more, and says so.
 *
 * It is also still the clearest example of how a screen is meant to look in
 * this codebase. It has no idea whether the people came from Supabase, from an
 * in-memory list, or from a future Go service: it calls a hook, the hook calls
 * a repository interface, and the composition root decided the rest.
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
    <ScreenContainer testID="screen-discover" edges={['bottom']}>
      <OfflineBanner />
      <ScreenHeader
        title="Everyone else"
        subtitle="Members near you, outside today's three"
        right={<Badge label={city ?? 'Pune'} tone="primary" />}
      />
      <Spacer size={12} />
      <AppText variant="caption" color="textSecondary">
        Browsing only. Liking happens in Today, where it counts for something.
      </AppText>
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
