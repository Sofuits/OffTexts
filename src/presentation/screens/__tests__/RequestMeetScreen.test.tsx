import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createTestContainer } from '@/app/di';
import { AppProviders, createTestQueryClient } from '@/app/providers';
import {
  AppError,
  failure,
  success,
  type MeetingRequest,
  type MeetRepository,
} from '@/domain/repositories';
import { RequestMeetScreen } from '@/presentation/screens';

/**
 * Booking a table.
 *
 * The venues come from the real in-memory repository, so the slots are
 * computed from real opening hours rather than from a list invented here —
 * which is what makes "the café is shut on Mondays" a case the test can
 * actually reach.
 */

const MATCH_ID = 'match-1';

function meetsRecording() {
  const seen: MeetingRequest[] = [];
  const repository: MeetRepository = {
    listMeets: async () => success([]),
    getMeetById: async () => failure(new AppError('notFound', 'not used')),
    requestMeeting: async (request) => {
      seen.push(request);
      return success('meet-42');
    },
    cancelMeet: async () => failure(new AppError('notFound', 'not used')),
  };
  return { seen, repository };
}

function renderScreen(meets?: MeetRepository) {
  const navigation = { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
  const props = {
    navigation,
    route: {
      key: 'RequestMeet',
      name: 'RequestMeet',
      params: { matchId: MATCH_ID, personName: 'Aanya Rao' },
    },
  } as unknown as React.ComponentProps<typeof RequestMeetScreen>;

  const container = createTestContainer(meets ? { repositories: { meets } } : {});

  return {
    navigation,
    ...render(
      <AppProviders container={container} queryClient={createTestQueryClient()}>
        <RequestMeetScreen {...props} />
      </AppProviders>,
    ),
  };
}

describe('RequestMeetScreen', () => {
  it('asks for a café before it asks for a day', async () => {
    renderScreen();

    expect(await screen.findByText('The Daily Grind')).toBeTruthy();
    // The café decides which days are possible, so the day chips cannot exist
    // before one is chosen.
    expect(screen.queryByTestId('chip-day-1')).toBeNull();
  });

  it('offers days once a café is chosen, and times once a day is', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('choice-venue-venue-1'));
    expect(await screen.findByTestId('chip-day-1')).toBeTruthy();

    fireEvent.press(screen.getByTestId('chip-day-1'));
    // The Daily Grind opens at 08:00, so 10am is offered.
    expect(await screen.findByTestId('chip-time-600')).toBeTruthy();
  });

  it('greys out a day the café is closed', async () => {
    renderScreen();

    // Pagdandi is shut on Mondays in the seed data.
    fireEvent.press(await screen.findByTestId('choice-venue-venue-2'));

    const days = await screen.findAllByTestId(/^chip-day-/);
    const mondays = days.filter((chip) => chip.props.accessibilityState?.disabled === true);

    // Fourteen days ahead always contains at least one Monday.
    expect(mondays.length).toBeGreaterThan(0);
  });

  it('keeps the confirm button disabled until all three answers are in', async () => {
    renderScreen();

    // The confirm button is on screen from the first frame, so waiting on it
    // proves nothing — wait for the venues, which are what the first answer
    // needs.
    const venue = await screen.findByTestId('choice-venue-venue-1');
    expect(screen.getByTestId('button-confirm-meet').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(venue);
    expect(screen.getByTestId('button-confirm-meet').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('chip-day-1'));
    expect(screen.getByTestId('button-confirm-meet').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('chip-time-600'));
    expect(screen.getByTestId('button-confirm-meet').props.accessibilityState.disabled).toBe(false);
  });

  it('clears the day and time when the café changes', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('choice-venue-venue-1'));
    fireEvent.press(screen.getByTestId('chip-day-1'));
    fireEvent.press(screen.getByTestId('chip-time-600'));
    expect(screen.getByTestId('booking-summary')).toBeTruthy();

    // A different café has different hours, so the chosen time may not exist
    // there at all. Carrying it over would offer a slot that does not.
    fireEvent.press(screen.getByTestId('choice-venue-venue-4'));
    expect(screen.queryByTestId('booking-summary')).toBeNull();
  });

  it('books the table and replaces the screen with the meet', async () => {
    const meets = meetsRecording();
    const { navigation } = renderScreen(meets.repository);

    fireEvent.press(await screen.findByTestId('choice-venue-venue-1'));
    fireEvent.press(screen.getByTestId('chip-day-1'));
    fireEvent.press(screen.getByTestId('chip-time-600'));
    fireEvent.press(screen.getByTestId('button-confirm-meet'));

    await waitFor(() => expect(meets.seen).toHaveLength(1));

    const request = meets.seen[0];
    expect(request?.matchId).toBe(MATCH_ID);
    expect(request?.venueId).toBe('venue-1');
    expect(request?.durationMinutes).toBe(60);
    expect(request?.scheduledFor.getHours()).toBe(10);

    // `replace`, not `navigate`: going back to a form for a booking that now
    // exists invites a second one.
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('MeetDetails', { meetId: 'meet-42' }),
    );
  });

  it('shows the failure rather than navigating', async () => {
    const broken: MeetRepository = {
      listMeets: async () => success([]),
      getMeetById: async () => failure(new AppError('notFound', 'not used')),
      requestMeeting: async () =>
        failure(new AppError('forbidden', 'That table is no longer free.')),
      cancelMeet: async () => failure(new AppError('notFound', 'not used')),
    };

    const { navigation } = renderScreen(broken);

    fireEvent.press(await screen.findByTestId('choice-venue-venue-1'));
    fireEvent.press(screen.getByTestId('chip-day-1'));
    fireEvent.press(screen.getByTestId('chip-time-600'));
    fireEvent.press(screen.getByTestId('button-confirm-meet'));

    expect(await screen.findByTestId('request-meet-error')).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
