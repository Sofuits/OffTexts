import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import {
  MeetListItem,
  OfflineBanner,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  Spacer,
} from '@/presentation/components';
import type { Meet } from '@/domain/entities';
import { useScheduledMeets } from '@/presentation/hooks';
import type { BottomTabScreenPropsFor } from '@/app/navigation/types';

type Props = BottomTabScreenPropsFor<'ScheduledMeets'>;

/**
 * Tab 3 — the member's meets, in two sections.
 *
 * The screen does not decide what "upcoming" means. `GetScheduledMeets` does,
 * and it arrives already split and sorted. That is the difference between a
 * rule the product owns and a filter a screen invented — the second kind is
 * what drifts when a second client is built.
 */
export function ScheduledMeetsScreen({ navigation }: Props): React.JSX.Element {
  const meets = useScheduledMeets();

  const openUpcoming = useCallback(
    (meet: Meet) => navigation.navigate('MeetDetails', { meetId: meet.id }),
    [navigation],
  );

  const openHistory = useCallback(
    (meet: Meet) =>
      navigation.navigate('RatingsReviews', { meetId: meet.id, personName: meet.personName }),
    [navigation],
  );

  return (
    <ScreenContainer testID="screen-scheduled-meets">
      <OfflineBanner />
      <ScreenHeader title="Your meets" subtitle="Confirmed tables and past meetups" showLogo />
      <Spacer size={24} />
      <Pressable
  onPress={() => navigation.navigate('AvailabilityStart')}
  style={styles.availabilityButton}
>
  <Text style={styles.availabilityButtonText}>
    Plan a meet
  </Text>
</Pressable>

<Spacer size={24} />

      <QueryBoundary
        isLoading={meets.isPending}
        error={meets.error}
        data={meets.data}
        onRetry={meets.refetch}
        isEmpty={(data) => data.upcoming.length === 0 && data.history.length === 0}
        emptyMessage="No meets yet. Find someone in Discover."
      >
        {({ upcoming, history }) => (
          <>
            <SectionHeader title="Upcoming" subtitle="Tap a meet to see the details" />
            <Spacer size={12} />
            {upcoming.length === 0 ? (
              <SectionHeader title="" subtitle="Nothing booked yet." />
            ) : (
              upcoming.map((meet, index) => (
                <React.Fragment key={meet.id}>
                  {index > 0 ? <Spacer size={12} /> : null}
                  <MeetListItem
                    meet={meet}
                    onPress={openUpcoming}
                    testID={`meet-upcoming-${meet.id}`}
                  />
                </React.Fragment>
              ))
            )}

            <Spacer size={32} />
            <SectionHeader title="History" subtitle="Tap a past meet to see ratings and reviews" />
            <Spacer size={12} />
            {history.length === 0 ? (
              <SectionHeader title="" subtitle="Your past meets will show up here." />
            ) : (
              history.map((meet, index) => (
                <React.Fragment key={meet.id}>
                  {index > 0 ? <Spacer size={12} /> : null}
                  <MeetListItem
                    meet={meet}
                    onPress={openHistory}
                    testID={`meet-history-${meet.id}`}
                  />
                </React.Fragment>
              ))
            )}
          </>
        )}
      </QueryBoundary>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  availabilityButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#496653',
  },

  availabilityButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
