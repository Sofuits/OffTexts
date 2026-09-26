import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type React from 'react';

import { createTestContainer } from '@/app/di';
import { AppProviders, createTestQueryClient } from '@/app/providers';
import {
  DEFAULT_PREFERENCES,
  EMPTY_PROFILE_DETAILS,
  type Person,
  type PreferencesUpdate,
  type ProfileDetails,
  type ProfileDetailsUpdate,
} from '@/domain/entities';
import {
  success,
  type PreferencesRepository,
  type ProfileDetailsRepository,
  type ProfileRepository,
  type ProfileUpdate,
} from '@/domain/repositories';
import {
  EditProfileSectionScreen,
  PersonProfileScreen,
  ProfileScreen,
} from '@/presentation/screens';

/**
 * Seeing and changing the profile after onboarding.
 *
 * Three screens, one idea: the answers given during onboarding are shown where
 * a profile is read, and each section can be changed with the same questions
 * that asked it. No Supabase — repositories written here record what they get.
 */

const ME: Person = {
  id: 'person-1',
  name: 'Saksham',
  headline: 'Would rather meet than message.',
  bio: 'Designs for a fintech and runs on weekends.',
  city: 'Pune',
  dateOfBirth: '1999-04-12',
  gender: 'man',
  photoUrls: [],
  interests: ['Coffee', 'Books', 'Startups'],
  intents: ['dating'],
  verification: 'verified',
  onboardingCompletedAt: '2026-09-26T00:00:00.000Z',
};

const MY_DETAILS: ProfileDetails = {
  ...EMPTY_PROFILE_DETAILS,
  lastName: 'Kulkarni',
  occupationStatus: 'working',
  jobTitle: 'Designer',
  relationshipGoal: 'long_term',
  religion: 'jain',
  onboardingStep: 'notifications',
};

function fakes(setup: {
  person?: Person;
  details?: ProfileDetails;
  shared?: ProfileDetails | null;
}) {
  let person = setup.person ?? ME;
  let details = setup.details ?? MY_DETAILS;
  const profileWrites: ProfileUpdate[] = [];
  const detailWrites: ProfileDetailsUpdate[] = [];
  const preferenceWrites: PreferencesUpdate[] = [];

  const profile: ProfileRepository = {
    getMyProfile: async () => success(person),
    getProfileById: async (id) => success({ ...person, id, name: 'Ananya' }),
    updateMyProfile: async (update) => {
      profileWrites.push(update);
      person = { ...person, ...update } as Person;
      return success(person);
    },
    completeMyOnboarding: async () => success(person),
  };
  const profileDetails: ProfileDetailsRepository = {
    getMyDetails: async () => success(details),
    updateMyDetails: async (update) => {
      detailWrites.push(update);
      details = { ...details, ...(update as Partial<ProfileDetails>) };
      return success(details);
    },
    getDetailsFor: async () => success(setup.shared ?? null),
  };
  const preferences: PreferencesRepository = {
    getMyPreferences: async () => success(DEFAULT_PREFERENCES),
    updateMyPreferences: async (update) => {
      preferenceWrites.push(update);
      return success({ ...DEFAULT_PREFERENCES, ...update });
    },
  };

  return {
    repositories: { profile, profileDetails, preferences },
    profileWrites,
    detailWrites,
    preferenceWrites,
  };
}

function renderScreen(element: React.JSX.Element, setup: Parameters<typeof fakes>[0] = {}) {
  const recorded = fakes(setup);
  const container = createTestContainer({ repositories: recorded.repositories });
  render(
    <AppProviders container={container} queryClient={createTestQueryClient()}>
      {element}
    </AppProviders>,
  );
  return recorded;
}

const navigation = () => ({ navigate: jest.fn(), goBack: jest.fn() });

const nextButton = () => screen.getByTestId('button-onboarding-next');

/* ------------------------------------------------------------ editing -- */

function editSection(section: string, setup: Parameters<typeof fakes>[0] = {}) {
  const nav = navigation();
  const props = {
    navigation: nav,
    route: { key: 'EditProfileSection', name: 'EditProfileSection', params: { section } },
  } as unknown as React.ComponentProps<typeof EditProfileSectionScreen>;
  return { nav, ...renderScreen(<EditProfileSectionScreen {...props} />, setup) };
}

describe('EditProfileSectionScreen', () => {
  it('saves a one-step section and closes, without touching onboarding progress', async () => {
    const { nav, detailWrites } = editSection('Lifestyle');

    await screen.findByText('A few lifestyle questions');
    fireEvent.press(screen.getByTestId('option-smoking-never'));
    fireEvent.press(nextButton());

    await waitFor(() => expect(nav.goBack).toHaveBeenCalledTimes(1));
    expect(detailWrites.at(-1)).toMatchObject({
      smoking: 'never',
      // Still "notifications": a finished member editing their lifestyle is
      // not thereby "at the lifestyle step".
      onboardingStep: 'notifications',
    });
  });

  it('walks every step of a multi-step section', async () => {
    const { nav } = editSection('Education & work');

    await screen.findByText('What are you up to these days?');
    fireEvent.press(nextButton());
    await screen.findByText('Your education');
    fireEvent.press(nextButton());
    await screen.findByText('What do you do?');
    fireEvent.press(nextButton());

    await waitFor(() => expect(nav.goBack).toHaveBeenCalledTimes(1));
  });

  it('follows a status change inside the section', async () => {
    editSection('Education & work');

    await screen.findByText('What are you up to these days?');
    fireEvent.press(screen.getByTestId('choice-status-studying'));
    fireEvent.press(nextButton());
    await screen.findByText('What are you studying?');
    fireEvent.press(nextButton());

    expect(await screen.findByText('A bit more about your studies')).toBeTruthy();
    expect(screen.queryByText('What do you do?')).toBeNull();
  });

  it('does not offer the birthday for editing', async () => {
    editSection('Basics');

    await screen.findByText('What should people call you?');
    fireEvent.press(nextButton());

    expect(await screen.findByText('How do you describe yourself?')).toBeTruthy();
    expect(screen.queryByText('When’s your birthday?')).toBeNull();
  });

  it('closes without saving when backing out of the first step', async () => {
    const { nav, detailWrites } = editSection('Lifestyle');

    await screen.findByText('A few lifestyle questions');
    fireEvent.press(screen.getByTestId('option-smoking-never'));
    fireEvent.press(screen.getByTestId('button-onboarding-back'));

    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(detailWrites).toEqual([]);
  });
});

/* ------------------------------------------------------- own profile -- */

function profileTab(setup: Parameters<typeof fakes>[0] = {}) {
  const nav = navigation();
  const props = {
    navigation: nav,
    route: { key: 'Profile', name: 'Profile', params: undefined },
  } as unknown as React.ComponentProps<typeof ProfileScreen>;
  return { nav, ...renderScreen(<ProfileScreen {...props} />, setup) };
}

describe('ProfileScreen, your details', () => {
  it('shows the saved answers, with hidden ones marked', async () => {
    profileTab();

    expect(await screen.findByTestId('profile-summary-self')).toBeTruthy();
    expect(screen.getByText('Saksham Kulkarni (only you)')).toBeTruthy();
    expect(screen.getByText('Designer')).toBeTruthy();
    expect(screen.getByText('Long-term')).toBeTruthy();
    expect(screen.queryByTestId('category-prompt')).toBeNull();
  });

  it('opens a section for editing', async () => {
    const { nav } = profileTab();

    fireEvent.press(await screen.findByTestId('button-edit-lifestyle'));

    expect(nav.navigate).toHaveBeenCalledWith('EditProfileSection', { section: 'Lifestyle' });
  });

  it('asks for the purpose questions a member has not answered', async () => {
    // Somebody who finished onboarding before the purpose questions existed.
    const { nav } = profileTab({
      details: { ...MY_DETAILS, relationshipGoal: undefined },
    });

    expect(await screen.findByTestId('category-prompt')).toBeTruthy();
    fireEvent.press(screen.getByTestId('button-answer-category'));

    expect(nav.navigate).toHaveBeenCalledWith('EditProfileSection', { section: 'Dating' });
  });
});

/* ------------------------------------------------------ other member -- */

describe('PersonProfileScreen, shared details', () => {
  function otherProfile(shared: ProfileDetails | null) {
    const props = {
      navigation: navigation(),
      route: {
        key: 'PersonProfile',
        name: 'PersonProfile',
        params: { personId: 'person-2', personName: 'Ananya' },
      },
    } as unknown as React.ComponentProps<typeof PersonProfileScreen>;
    return renderScreen(<PersonProfileScreen {...props} />, { shared });
  }

  it('shows what the member shares, and never anything marked private', async () => {
    otherProfile({ ...EMPTY_PROFILE_DETAILS, jobTitle: 'Architect', occupationStatus: 'working' });

    expect(await screen.findByText('Architect')).toBeTruthy();
    expect(screen.getByTestId('profile-summary-other')).toBeTruthy();
    expect(screen.queryByText(/only you/)).toBeNull();
    expect(screen.queryByText('Preferences')).toBeNull();
    // Empty sections are left out rather than saying "Nothing added yet".
    expect(screen.queryByText('Nothing added yet.')).toBeNull();
  });

  it('still shows the profile when nothing is shared', async () => {
    otherProfile(null);

    expect(await screen.findByTestId('profile-summary-other')).toBeTruthy();
    // The basics from the profile itself still show.
    expect(await screen.findByText('Coffee, Books, Startups')).toBeTruthy();
  });
});
