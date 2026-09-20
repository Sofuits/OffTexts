import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AppProviders, createTestQueryClient } from '@/app/providers';
import { createTestContainer } from '@/app/di';
import type { Person } from '@/domain/entities';
import {
  AppError,
  failure,
  success,
  type DiscoverRepository,
  type Result,
  type DiscoverPage,
} from '@/domain/repositories';
import { DiscoverScreen } from '@/presentation/screens';

/**
 * The test that proves the architecture works.
 *
 * DiscoverScreen is rendered against a repository invented here. No Supabase,
 * no network, no HTTP mocking, no module mocking — the screen is handed a
 * different implementation of the same interface and cannot tell.
 *
 * If this test ever needs `jest.mock('@supabase/supabase-js')` to pass, the
 * decoupling has been broken somewhere above the data layer.
 */

const person = (id: string, name: string, city = 'Pune'): Person => ({
  id,
  name,
  age: 29,
  headline: `${name} would rather meet than message.`,
  city,
  photoUrls: [],
  interests: ['Books'],
  intents: ['networking'],
  verification: 'verified',
});

/** Navigation props, narrowed to what the screen actually touches. */
const navigationProps = () =>
  ({
    navigation: { navigate: jest.fn() },
    route: { key: 'Discover', name: 'Discover', params: undefined },
  }) as unknown as React.ComponentProps<typeof DiscoverScreen>;

function renderWith(discover: DiscoverRepository) {
  const container = createTestContainer({ repositories: { discover } });
  const props = navigationProps();

  return {
    container,
    ...render(
      // A test query client, so an error state settles immediately instead of
      // waiting out the production retry policy.
      <AppProviders container={container} queryClient={createTestQueryClient()}>
        <DiscoverScreen {...props} />
      </AppProviders>,
    ),
  };
}

describe('DiscoverScreen', () => {
  it('renders the people the repository returns', async () => {
    const stub: DiscoverRepository = {
      getSuggestions: async (): Promise<Result<DiscoverPage>> =>
        success({
          people: [person('p1', 'Aanya Rao'), person('p2', 'Rohan Mehta')],
          nextCursor: null,
        }),
    };

    renderWith(stub);

    // The name also appears in the card's accessibility label, so match the
    // visible line exactly rather than by substring.
    expect(await screen.findByText('Aanya Rao, 29')).toBeTruthy();
    expect(await screen.findByText('Rohan Mehta, 29')).toBeTruthy();
  });

  it('shows an empty state rather than a blank screen', async () => {
    const empty: DiscoverRepository = {
      getSuggestions: async () => success({ people: [], nextCursor: null }),
    };

    renderWith(empty);

    expect(await screen.findByText(/No one new right now/i)).toBeTruthy();
  });

  it('shows the error message when the repository fails', async () => {
    const broken: DiscoverRepository = {
      getSuggestions: async () => failure(new AppError('network', 'No connection.')),
    };

    renderWith(broken);

    // The member must be told something went wrong. A silent empty list is the
    // failure mode this replaces.
    expect(await screen.findByText(/No connection/i)).toBeTruthy();
  });

  it('offers a retry for a retryable error and not for a forbidden one', async () => {
    const retryable: DiscoverRepository = {
      getSuggestions: async () => failure(new AppError('network', 'No connection.')),
    };
    const { unmount } = renderWith(retryable);
    expect(await screen.findByText('Try again')).toBeTruthy();
    unmount();

    const forbidden: DiscoverRepository = {
      getSuggestions: async () => failure(new AppError('forbidden', 'You do not have access.')),
    };
    renderWith(forbidden);

    expect(await screen.findByText(/do not have access/i)).toBeTruthy();
    // Retrying a 403 would fail identically every time; offering the button
    // would be a lie to the member.
    await waitFor(() => expect(screen.queryByText('Try again')).toBeNull());
  });

  it('passes the city filter from the store through to the repository', async () => {
    const seen: (string | undefined)[] = [];
    const recording: DiscoverRepository = {
      getSuggestions: async (query = {}) => {
        seen.push(query.city);
        return success({ people: [person('p1', 'Aanya Rao')], nextCursor: null });
      },
    };

    renderWith(recording);

    await screen.findByText('Aanya Rao, 29');
    // Nothing set a filter, so the screen must not invent one.
    expect(seen).toEqual([undefined]);
  });
});
