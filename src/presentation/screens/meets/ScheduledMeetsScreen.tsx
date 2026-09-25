import React, { useCallback } from 'react';

import {
  AppText,
  Button,
  EmptyState,
  MatchListItem,
  MeetListItem,
  OfflineBanner,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  Spacer,
} from '@/presentation/components';
import type { Match, Meet } from '@/domain/entities';
import { useMatches, useScheduledMeets } from '@/presentation/hooks';
import type { BottomTabScreenPropsFor } from '@/app/navigation/types';
import { env } from '@/shared/config';

type Props = BottomTabScreenPropsFor<'ScheduledMeets'>;

/**
 * Tab 3 — matches and meets, in that order.
 *
 * Matches sit above the bookings because of what the app leaves out. There is
 * no chat, so a match produces no thread, no notification trail, nothing that
 * keeps it in view — it exists only here. Putting it under two lists of
 * bookings would be hiding the one thing that needs acting on.
 *
 * The screen does not decide what "upcoming" means. `GetScheduledMeets` does,
 * and it arrives already split and sorted. That is the difference between a
 * rule the product owns and a filter a screen invented — the second kind is
 * what drifts when a second client is built.
 *
 * Two queries rather than one because they fail independently. A matching
 * outage should not blank somebody's confirmed table on Thursday.
 */
export function ScheduledMeetsScreen({ navigation }: Props): React.JSX.Element {
  const matches = useMatches();
  const meets = useScheduledMeets();

  const openMatch = useCallback(
    (match: Match) =>
      // The match id goes with them: it is what lets their profile offer a
      // booking, and there is no way to ask the database "am I matched with
      // this person" from the other direction.
      navigation.navigate('PersonProfile', {
        personId: match.person.id,
        personName: match.person.name,
        matchId: match.id,
      }),
    [navigation],
  );

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
      <ScreenHeader
        title="Your meets"
        subtitle="Matches, tables booked, and the ones that happened"
        showLogo
      />
      <Spacer size={24} />

      {/* The date planner is a preview: the other person's dates are invented
          on the phone until the scheduling schema exists. So it is offered in
          development and staging builds only, never to a real member. */}
      {!env.isProduction ? (
        <>
          <Button
            label="Plan dates (preview)"
            variant="secondary"
            fullWidth
            onPress={() => navigation.navigate('AvailabilityStart')}
            testID="button-plan-dates"
          />
          <Spacer size={8} />
          <AppText variant="caption">
            Not in production builds. The other person’s dates are placeholders.
          </AppText>
          <Spacer size={24} />
        </>
      ) : null}

      <SectionHeader title="Matches" subtitle="You both said yes. Nobody else can see this." />
      <Spacer size={12} />
      <QueryBoundary
        isLoading={matches.isPending}
        error={matches.error}
        data={matches.data}
        onRetry={matches.refetch}
        emptyMessage="No matches yet. Like someone in Today — if it is mutual, they turn up here."
      >
        {(list) =>
          list.map((match, index) => (
            <React.Fragment key={match.id}>
              {index > 0 ? <Spacer size={12} /> : null}
              <MatchListItem
                match={match}
                onPress={openMatch}
                testID={`match-${match.person.id}`}
              />
            </React.Fragment>
          ))
        }
      </QueryBoundary>

      <Spacer size={32} />

      <QueryBoundary
        isLoading={meets.isPending}
        error={meets.error}
        data={meets.data}
        onRetry={meets.refetch}
        isEmpty={() => false}
      >
        {({ upcoming, history }) => (
          <>
            <SectionHeader title="Upcoming" subtitle="Tap a meet to see the details" />
            <Spacer size={12} />
            {upcoming.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="Nothing booked"
                body="A match is a yes, not a plan. Pick a café and a time and we will hold the table."
                testID="meets-upcoming-empty"
              />
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
              <AppText variant="body" color="textSecondary">
                Your past meets will show up here.
              </AppText>
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
