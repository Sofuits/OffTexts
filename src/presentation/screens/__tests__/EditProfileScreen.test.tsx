import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AppProviders, createTestQueryClient } from '@/app/providers';
import { createTestContainer } from '@/app/di';
import type { Person } from '@/domain/entities';
import {
  AppError,
  failure,
  success,
  type ProfileRepository,
  type ProfileUpdate,
  type Result,
} from '@/domain/repositories';
import { EditProfileScreen } from '@/presentation/screens';

/**
 * The only screen that writes to the database.
 *
 * Same rule as DiscoverScreen: the repository is invented here, so this runs
 * with no Supabase, no network and no module mocking. What is being tested is
 * the screen's contract with the interface — that it sends the right update,
 * and only when the input is valid.
 */

const ME: Person = {
  id: 'me',
  name: 'Aanya Rao',
  age: 29,
  headline: 'Would rather meet than message.',
  bio: 'Books, long walks, fintech.',
  city: 'Pune',
  photoUrls: [],
  interests: ['Books'],
  intents: ['networking'],
  verification: 'verified',
};

/** Records what was asked of it, so a test can assert on the update itself. */
function fakeProfiles(
  overrides: Partial<ProfileRepository> = {},
): ProfileRepository & { updates: ProfileUpdate[] } {
  const updates: ProfileUpdate[] = [];

  return {
    updates,
    getMyProfile: async (): Promise<Result<Person>> => success(ME),
    getProfileById: async (): Promise<Result<Person>> => success(ME),
    updateMyProfile: async (update: ProfileUpdate): Promise<Result<Person>> => {
      updates.push(update);
      return success({ ...ME, ...update });
    },
    uploadPhoto: async (): Promise<Result<string>> => success('https://example.test/photo.jpg'),
    ...overrides,
  } as ProfileRepository & { updates: ProfileUpdate[] };
}

const goBack = jest.fn();

const navigationProps = () =>
  ({
    navigation: { goBack },
    route: { key: 'EditProfile', name: 'EditProfile', params: undefined },
  }) as unknown as React.ComponentProps<typeof EditProfileScreen>;

function renderWith(profile: ProfileRepository) {
  const container = createTestContainer({ repositories: { profile } });

  return render(
    <AppProviders container={container} queryClient={createTestQueryClient()}>
      <EditProfileScreen {...navigationProps()} />
    </AppProviders>,
  );
}

beforeEach(() => goBack.mockClear());

describe('EditProfileScreen', () => {
  it('fills the form from the profile that already exists', async () => {
    renderWith(fakeProfiles());

    // Values, not placeholders: a form that renders blank and fills in later is
    // how a member's first keystrokes get discarded.
    expect(await screen.findByDisplayValue('Aanya Rao')).toBeTruthy();
    expect(screen.getByDisplayValue('Pune')).toBeTruthy();
    expect(screen.getByDisplayValue('29')).toBeTruthy();
  });

  it('sends only the fields that changed', async () => {
    const profiles = fakeProfiles();
    renderWith(profiles);

    await screen.findByDisplayValue('Aanya Rao');
    fireEvent.changeText(screen.getByTestId('input-city'), 'Mumbai');
    fireEvent.press(screen.getByTestId('button-save-profile'));

    await waitFor(() => expect(profiles.updates).toHaveLength(1));
    // Not the name, headline, bio or age — those are untouched, and sending
    // them would overwrite whatever they hold on the server.
    expect(profiles.updates[0]).toEqual({ city: 'Mumbai' });
  });

  it('closes without writing anything when nothing was edited', async () => {
    const profiles = fakeProfiles();
    renderWith(profiles);

    await screen.findByDisplayValue('Aanya Rao');
    fireEvent.press(screen.getByTestId('button-save-profile'));

    await waitFor(() => expect(goBack).toHaveBeenCalled());
    expect(profiles.updates).toHaveLength(0);
  });

  it('refuses to save an invalid field and says why', async () => {
    const profiles = fakeProfiles();
    renderWith(profiles);

    await screen.findByDisplayValue('Aanya Rao');
    fireEvent.changeText(screen.getByTestId('input-name'), 'A');
    fireEvent.press(screen.getByTestId('button-save-profile'));

    expect(await screen.findByText('Enter your full name.')).toBeTruthy();
    expect(profiles.updates).toHaveLength(0);
    expect(goBack).not.toHaveBeenCalled();
  });

  it('enforces the 18+ rule before the database has to', async () => {
    const profiles = fakeProfiles();
    renderWith(profiles);

    await screen.findByDisplayValue('Aanya Rao');
    fireEvent.changeText(screen.getByTestId('input-age'), '16');
    fireEvent.press(screen.getByTestId('button-save-profile'));

    // The CHECK constraint in 0001 is the guarantee; this is the courtesy.
    expect(await screen.findByText('Offtexts is 18 and over.')).toBeTruthy();
    expect(profiles.updates).toHaveLength(0);
  });

  it('keeps the member on the screen when the save fails', async () => {
    const profiles = fakeProfiles({
      updateMyProfile: async () => failure(new AppError('network', 'You appear to be offline.')),
    });
    renderWith(profiles);

    await screen.findByDisplayValue('Aanya Rao');
    fireEvent.changeText(screen.getByTestId('input-city'), 'Mumbai');
    fireEvent.press(screen.getByTestId('button-save-profile'));

    expect(await screen.findByTestId('error-save')).toBeTruthy();
    // Navigating away on a failed save loses the member's edits silently.
    expect(goBack).not.toHaveBeenCalled();
  });

  it('toggles an intent and sends the new set', async () => {
    const profiles = fakeProfiles();
    renderWith(profiles);

    await screen.findByDisplayValue('Aanya Rao');
    fireEvent.press(screen.getByTestId('chip-dating'));
    fireEvent.press(screen.getByTestId('button-save-profile'));

    await waitFor(() => expect(profiles.updates).toHaveLength(1));
    expect(profiles.updates[0]).toEqual({ intents: ['networking', 'dating'] });
  });
});
