import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Chip,
  ChipGroup,
  ChoiceRow,
  QueryBoundary,
  ScreenContainer,
  SectionHeader,
  Spacer,
} from '@/presentation/components';
import { isOpenOn, startTimesOn, type Venue, type VenueId } from '@/domain/entities';
import { RequestMeet } from '@/domain/usecases';
import { useMyProfile, useNow, useRequestMeet, useVenues } from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { RootStackScreenProps } from '@/app/navigation/types';
import { formatDayAndDate } from '@/shared/utils/date';

type Props = RootStackScreenProps<'RequestMeet'>;

/** How far ahead a table can be booked. Two weeks is as far as anybody plans coffee. */
const DAYS_AHEAD = 14;
const DURATION_MINUTES = RequestMeet.DEFAULT_DURATION_MINUTES;

/**
 * Booking a table.
 *
 * Café, then day, then time, in that order and on one screen. The order is not
 * arbitrary: the café decides which days are possible (some are shut on
 * Mondays) and the day decides which times are, so asking for a time first
 * would mean offering slots that have to be taken away again.
 *
 * WHY THE SLOTS ARE COMPUTED HERE
 * They come from the venue's own opening hours, which `api_v1.venues` returns
 * with the café rather than as a second request. That makes this arithmetic,
 * not a query — and the same arithmetic lives in `domain/entities/Venue`, so
 * the admin portal can offer the same slots without reimplementing it.
 *
 * WHAT THIS SCREEN DOES NOT DO
 * No payment. The fee is read and stored server-side at the moment of booking
 * (`api_v1.request_meeting`), and collecting it is a separate piece of work
 * waiting on decisions that have not been made — who pays, and whether there is
 * a wallet. Booking without paying is the honest interim: the row records what
 * the fee was, and nothing pretends money changed hands.
 */
export function RequestMeetScreen({ route, navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const { matchId, personName } = route.params;

  const profile = useMyProfile();
  // Held until the profile resolves. Firing with no city would fetch every
  // café in the country and then replace the list a moment later.
  const venues = useVenues(profile.data?.city, { enabled: !profile.isPending });
  const book = useRequestMeet();

  const [venueId, setVenueId] = useState<VenueId | null>(null);
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [startMinutes, setStartMinutes] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The clock as state, ticking once a minute. Reading `Date.now()` during a
  // render would freeze it at whenever React last happened to re-render — so a
  // member who opens the time list at 4:58 and thinks for five minutes would
  // still be offered 5:00. See `useNow`.
  const now = useNow();
  const days = useMemo(() => nextDays(now, DAYS_AHEAD), [now]);

  const venue = venues.data?.find((candidate) => candidate.id === venueId) ?? null;
  const day = dayIndex === null ? null : (days[dayIndex] ?? null);

  const times = useMemo(() => {
    if (!venue || !day) return [];
    const earliest = now.getTime() + RequestMeet.MIN_NOTICE_MINUTES * 60_000;
    return startTimesOn(venue, day.getDay(), DURATION_MINUTES).filter(
      (minutes) => at(day, minutes).getTime() >= earliest,
    );
  }, [venue, day, now]);

  const chooseVenue = useCallback((next: Venue) => {
    setVenueId(next.id);
    // The new café may be shut on the chosen day and will certainly have
    // different hours, so both later answers stop being valid.
    setDayIndex(null);
    setStartMinutes(null);
    setError(null);
  }, []);

  const chooseDay = useCallback((index: number) => {
    setDayIndex(index);
    setStartMinutes(null);
    setError(null);
  }, []);

  const confirm = useCallback(() => {
    if (!venue || !day || startMinutes === null) return;
    setError(null);

    book.mutate(
      {
        matchId,
        venueId: venue.id,
        scheduledFor: at(day, startMinutes),
        durationMinutes: DURATION_MINUTES,
      },
      {
        onSuccess: (meetId) => {
          // `replace`, not `navigate`. Going back to a booking form for a
          // booking that now exists invites a second one.
          navigation.replace('MeetDetails', { meetId });
        },
        onError: (caught) => setError(caught.message),
      },
    );
  }, [book, matchId, venue, day, startMinutes, navigation]);

  const ready = venue !== null && day !== null && startMinutes !== null;

  return (
    <ScreenContainer testID="screen-request-meet" edges={['bottom']}>
      <AppText variant="heading">{`Coffee with ${personName}`}</AppText>
      <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing[8] }}>
        Pick a café and a time. We hold the table and tell them — there is nothing to message.
      </AppText>

      <Spacer size={32} />
      <SectionHeader title="Where" subtitle="Partner cafés near you" />
      <Spacer size={12} />

      <QueryBoundary
        isLoading={venues.isPending}
        error={venues.error}
        data={venues.data}
        onRetry={venues.refetch}
        emptyMessage="No partner cafés in your city yet. We are working on it — tell us where you would like one."
      >
        {(list) => (
          <View style={{ gap: theme.spacing[12] }}>
            {list.map((candidate) => (
              <ChoiceRow
                key={candidate.id}
                label={candidate.name}
                description={`${candidate.area} · ${candidate.addressLine}`}
                selected={venueId === candidate.id}
                onPress={() => chooseVenue(candidate)}
                icon="cafe-outline"
                testID={`choice-venue-${candidate.id}`}
              />
            ))}
          </View>
        )}
      </QueryBoundary>

      {venue ? (
        <>
          <Spacer size={32} />
          <SectionHeader title="When" subtitle={`Days ${venue.name} is open`} />
          <Spacer size={12} />
          <ChipGroup>
            {days.map((date, index) => {
              const open = isOpenOn(venue, date.getDay());
              return (
                <Chip
                  key={date.toISOString()}
                  label={index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : shortDay(date)}
                  selected={dayIndex === index}
                  disabled={!open}
                  onPress={() => chooseDay(index)}
                  testID={`chip-day-${index}`}
                />
              );
            })}
          </ChipGroup>
          {/* Only when there is something greyed out. A café open seven days
              would otherwise be captioned with an explanation of an absence. */}
          {days.some((date) => !isOpenOn(venue, date.getDay())) ? (
            <>
              <Spacer size={8} />
              <AppText variant="caption" color="textSecondary">
                Greyed-out days are when {venue.name} is closed.
              </AppText>
            </>
          ) : null}
        </>
      ) : null}

      {venue && day ? (
        <>
          <Spacer size={24} />
          <AppText variant="label" color="textSecondary">
            {formatDayAndDate(day)}
          </AppText>
          <Spacer size={12} />
          {times.length === 0 ? (
            <AppText variant="body" color="textSecondary" testID="no-times">
              Nothing left that day. Try the next one — a table needs at least{' '}
              {RequestMeet.MIN_NOTICE_MINUTES} minutes’ notice.
            </AppText>
          ) : (
            <ChipGroup>
              {times.map((minutes) => (
                <Chip
                  key={minutes}
                  label={clock(minutes)}
                  selected={startMinutes === minutes}
                  onPress={() => {
                    setStartMinutes(minutes);
                    setError(null);
                  }}
                  testID={`chip-time-${minutes}`}
                />
              ))}
            </ChipGroup>
          )}
        </>
      ) : null}

      <Spacer size={32} />

      {ready ? (
        <View
          style={[
            styles.summary,
            {
              backgroundColor: theme.colors.inset,
              borderRadius: theme.radii.lg,
              borderColor: theme.colors.border,
              padding: theme.spacing[16],
            },
          ]}
          testID="booking-summary"
        >
          <AppText variant="bodyStrong">{venue.name}</AppText>
          <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing[4] }}>
            {`${formatDayAndDate(day)} at ${clock(startMinutes)} · ${DURATION_MINUTES} minutes`}
          </AppText>
          <AppText variant="caption" color="textSecondary" style={{ marginTop: theme.spacing[8] }}>
            {personName} has to accept before the table is confirmed. Either of you can cancel.
          </AppText>
        </View>
      ) : null}

      {error ? (
        <>
          <Spacer size={16} />
          <AppText variant="caption" color="danger" testID="request-meet-error">
            {error}
          </AppText>
        </>
      ) : null}

      <Spacer size={24} />
      <Button
        label="Ask for this table"
        size="lg"
        fullWidth
        disabled={!ready}
        loading={book.isPending}
        onPress={confirm}
        testID="button-confirm-meet"
      />
      <Spacer size={16} />
    </ScreenContainer>
  );
}

/* ------------------------------------------------------------------ time -- */

/** Today plus the next `count - 1` days, at local midnight. */
function nextDays(from: Date, count: number): Date[] {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(start);
    // setDate rather than adding 86,400,000ms: the arithmetic version lands an
    // hour out on the two days a year a time zone shifts.
    date.setDate(start.getDate() + offset);
    return date;
  });
}

/** A local-midnight date plus minutes, as an instant. */
function at(day: Date, minutes: number): Date {
  const date = new Date(day);
  date.setHours(0, minutes, 0, 0);
  return date;
}

/** `570` -> `9:30 am`. */
function clock(minutes: number): string {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 < 12 ? 'am' : 'pm';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** `Thu 25` */
function shortDay(date: Date): string {
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()}`;
}

const styles = StyleSheet.create({
  summary: { borderWidth: StyleSheet.hairlineWidth },
});
