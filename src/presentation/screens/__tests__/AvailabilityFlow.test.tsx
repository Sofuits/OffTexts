import {
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';

import { createTestContainer } from '@/app/di';
import { RootNavigator } from '@/app/navigation';
import { AppProviders, createTestQueryClient } from '@/app/providers';
import type { AuthState, Session } from '@/domain/entities';
import { success, type AuthRepository } from '@/domain/repositories';
import { env } from '@/shared/config';
import { toDateKey } from '@/shared/utils/calendar';

/**
 * The date planner, walked through the real navigator: from the Meets tab to
 * the screen where the preview stops. Every screen on the way is registered —
 * that is half of what this test is for. The other half is the five bugs the
 * original branch had, each pinned below where it would show.
 *
 * Dates are chosen in NEXT month, so every day is in the future whatever day
 * the suite runs on.
 */

// A whole walk through the navigator is a long chain of async waits, each
// behind the in-memory repositories' simulated latency. Under the full suite,
// running in parallel, the one-second default for findBy was sometimes not
// enough for Today to settle before the walk began — a flake, not a failure.
// Longer waits for this file only; the assertions are unchanged.
configure({ asyncUtilTimeout: 10_000 });
jest.setTimeout(60_000);

const SESSION: Session = {
  user: { id: 'user-1', email: 'you@example.com', profileId: 'person-1' },
};

function signedIn(): AuthRepository {
  const state: AuthState = { status: 'signedIn', session: SESSION };
  return {
    getSession: async () => success(SESSION),
    observeAuthState: (listener) => {
      listener(state);
      return () => {};
    },
    signInWithOAuth: async () => success(SESSION),
    signInWithPassword: async () => success(SESSION),
    signUpWithPassword: async () => success(SESSION),
    sendMagicLink: async () => success(undefined),
    sendPasswordReset: async () => success(undefined),
    signOut: async () => success(undefined),
  };
}

function renderApp() {
  const container = createTestContainer({ repositories: { auth: signedIn() } });
  return render(
    <AppProviders container={container} queryClient={createTestQueryClient()}>
      <RootNavigator />
    </AppProviders>,
  );
}

const now = new Date();
const nextMonth = (day: number): string =>
  toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, day));

async function openMeetsTab(): Promise<void> {
  // Let Today settle first, so its query does not resolve after teardown.
  await screen.findByText('Person 1 of 3');
  fireEvent.press(screen.getByText('Meets'));
  await screen.findByTestId('screen-scheduled-meets');
}

const rowOrder = (): string[] =>
  screen.getAllByTestId(/^shared-row-/).map((row) => row.props.testID.replace('shared-row-', ''));

describe('date planner (preview)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('walks from the Meets tab to where the preview stops, with nothing dead-ending', async () => {
    renderApp();
    await openMeetsTab();

    fireEvent.press(screen.getByTestId('button-plan-dates'));
    fireEvent.press(await screen.findByTestId('button-choose-dates'));
    await screen.findByTestId('screen-availability-select-dates');

    // Past days cannot be picked, and there is no earlier month to go to.
    expect(screen.getByTestId('calendar-prev').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    if (now.getDate() > 1) {
      const yesterday = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
      expect(
        screen.getByTestId(`calendar-day-${yesterday}`).props.accessibilityState,
      ).toMatchObject({ disabled: true });
    }
    expect(screen.getByTestId('button-dates-continue').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    // Next month, tapped out of order.
    fireEvent.press(screen.getByTestId('calendar-next'));
    for (const day of [20, 5, 12])
      fireEvent.press(screen.getByTestId(`calendar-day-${nextMonth(day)}`));
    fireEvent.press(screen.getByTestId('button-dates-continue'));

    // The table: date order, not tap order; the placeholder says so.
    await screen.findByTestId('screen-availability-shared-dates');
    expect(await screen.findByTestId('placeholder-notice')).toBeTruthy();
    // Mine: 5, 12, 20. The placeholder: 5 and 20 (every other one), 6 and 21.
    expect(rowOrder()).toEqual([5, 6, 12, 20, 21].map(nextMonth));
    expect(screen.getByTestId('shared-summary')).toHaveTextContent('2 days work for both of you.');

    // My column is editable: take the 12th off, put the 6th on.
    fireEvent.press(screen.getByTestId(`shared-you-${nextMonth(12)}`));
    fireEvent.press(screen.getByTestId(`shared-you-${nextMonth(6)}`));
    expect(screen.getByTestId('shared-summary')).toHaveTextContent('3 days work for both of you.');
    fireEvent.press(screen.getByTestId('button-shared-continue'));

    // Choose the LAST of three, and it is the one that arrives (it used to
    // pass every common date on and lose the choice).
    await screen.findByTestId('screen-availability-choose-date');
    fireEvent.press(screen.getByTestId(`choice-date-${nextMonth(20)}`));
    fireEvent.press(screen.getByTestId('button-confirm-day'));
    await screen.findByTestId('screen-availability-date-selected');
    const selected = screen.getByTestId('selected-date');
    expect(selected).toHaveTextContent(new RegExp(`\\b20 `));

    // "Change day" comes back to every option, not just the one chosen.
    fireEvent.press(screen.getByTestId('button-change-day'));
    await screen.findByTestId('screen-availability-choose-date');
    for (const day of [5, 6, 20]) {
      expect(screen.getByTestId(`choice-date-${nextMonth(day)}`)).toBeTruthy();
    }
    fireEvent.press(screen.getByTestId(`choice-date-${nextMonth(6)}`));
    fireEvent.press(screen.getByTestId('button-confirm-day'));
    await waitFor(() =>
      expect(screen.getByTestId('selected-date')).toHaveTextContent(new RegExp(`\\b6 `)),
    );

    // Continue lands on a registered screen that says where the preview stops.
    fireEvent.press(screen.getByTestId('button-continue-times'));
    const times = await screen.findByTestId('screen-availability-times');
    expect(within(times).getByText('Choosing a time comes next')).toBeTruthy();

    fireEvent.press(screen.getByTestId('button-back-to-meets'));
    expect(await screen.findByTestId('screen-scheduled-meets')).toBeTruthy();
  });

  it('cannot continue from the table while no day works for both', async () => {
    renderApp();
    await openMeetsTab();
    fireEvent.press(screen.getByTestId('button-plan-dates'));
    fireEvent.press(await screen.findByTestId('button-choose-dates'));
    await screen.findByTestId('screen-availability-select-dates');
    fireEvent.press(screen.getByTestId('calendar-next'));
    fireEvent.press(screen.getByTestId(`calendar-day-${nextMonth(9)}`));
    fireEvent.press(screen.getByTestId('button-dates-continue'));

    // One date: the placeholder shares it. Untick it and nothing is shared.
    await screen.findByTestId(`shared-you-${nextMonth(9)}`);
    fireEvent.press(screen.getByTestId(`shared-you-${nextMonth(9)}`));

    expect(screen.getByTestId('shared-summary')).toHaveTextContent(/No day works for both/);
    expect(screen.getByTestId('button-shared-continue').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('is not offered in a production build', async () => {
    jest.replaceProperty(env, 'isProduction', true);

    renderApp();
    await openMeetsTab();

    expect(screen.queryByTestId('button-plan-dates')).toBeNull();
  });
});
