import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { createTestContainer } from '@/app/di';
import { AppProviders, createTestQueryClient } from '@/app/providers';
import {
  DEFAULT_PREFERENCES,
  EMPTY_PROFILE_DETAILS,
  type Person,
  type Photo,
  type PreferencesUpdate,
  type ProfileDetails,
  type ProfileDetailsUpdate,
} from '@/domain/entities';
import {
  AppError,
  failure,
  success,
  type PhotoRepository,
  type PreferencesRepository,
  type ProfileDetailsRepository,
  type ProfileRepository,
  type ProfileUpdate,
} from '@/domain/repositories';
import { OnboardingScreen } from '@/presentation/screens';

/**
 * The onboarding wizard.
 *
 * What is being tested is the flow, not the styling: that the next button
 * refuses an unanswered question, that conditional steps appear only when they
 * apply, that every step is saved as the member goes, and that a member who
 * comes back resumes where they stopped.
 *
 * No Supabase, no mocking framework, no native modules. Hand-written
 * repositories record what they are handed — which is the whole point of the
 * repositories being interfaces.
 */

const FRESH: Person = {
  id: 'person-1',
  name: 'New member',
  headline: '',
  city: 'Pune',
  photoUrls: [],
  interests: [],
  intents: [],
  verification: 'unverified',
};

const photo = (id: string, sortOrder: number): Photo => ({
  id,
  url: `https://example.test/${id}.jpg`,
  storagePath: `person-1/${id}.jpg`,
  sortOrder,
  moderation: 'pending',
});

type Setup = {
  person?: Person;
  details?: ProfileDetails;
  photos?: Photo[];
  failDetailsWrites?: boolean;
};

function fakes(setup: Setup = {}) {
  let person: Person = setup.person ?? FRESH;
  let details: ProfileDetails = setup.details ?? { ...EMPTY_PROFILE_DETAILS };
  const profileWrites: ProfileUpdate[] = [];
  const detailWrites: ProfileDetailsUpdate[] = [];
  const preferenceWrites: PreferencesUpdate[] = [];
  let completed = 0;

  const profile: ProfileRepository = {
    getMyProfile: async () => success(person),
    getProfileById: async () => success(person),
    updateMyProfile: async (update) => {
      profileWrites.push(update);
      person = { ...person, ...update } as Person;
      return success(person);
    },
    completeMyOnboarding: async () => {
      completed += 1;
      person = { ...person, onboardingCompletedAt: '2026-09-26T00:00:00.000Z' };
      return success(person);
    },
  };

  const profileDetails: ProfileDetailsRepository = {
    getMyDetails: async () => success(details),
    updateMyDetails: async (update) => {
      if (setup.failDetailsWrites) {
        return failure(
          new AppError('network', 'No connection. Check your internet and try again.'),
        );
      }
      detailWrites.push(update);
      details = { ...details, ...(update as Partial<ProfileDetails>) };
      return success(details);
    },
    getDetailsFor: async () => success(null),
  };

  const preferences: PreferencesRepository = {
    getMyPreferences: async () => success(DEFAULT_PREFERENCES),
    updateMyPreferences: async (update) => {
      preferenceWrites.push(update);
      return success({ ...DEFAULT_PREFERENCES, ...update });
    },
  };

  const photos: PhotoRepository = {
    listMyPhotos: async () => success(setup.photos ?? []),
    addPhoto: async () => failure(new AppError('unknown', 'not in tests')),
    removePhoto: async () => success(undefined),
    setPhotoOrder: async () => success(undefined),
  };

  return {
    repositories: { profile, profileDetails, preferences, photos },
    profileWrites,
    detailWrites,
    preferenceWrites,
    completedCount: () => completed,
  };
}

function renderWizard(setup: Setup = {}) {
  const recorded = fakes(setup);
  const container = createTestContainer({ repositories: recorded.repositories });

  render(
    <AppProviders container={container} queryClient={createTestQueryClient()}>
      <OnboardingScreen />
    </AppProviders>,
  );

  return { ...recorded, container };
}

const nextButton = () => screen.getByTestId('button-onboarding-next');
const isNextDisabled = (): boolean => nextButton().props.accessibilityState.disabled === true;

/** Presses continue and waits for the save to land and the next question to show. */
async function next(expected: string): Promise<void> {
  fireEvent.press(nextButton());
  expect(await screen.findByText(expected)).toBeTruthy();
}

function enterBirthday(): void {
  fireEvent.changeText(screen.getByTestId('input-dob-day'), '12');
  fireEvent.changeText(screen.getByTestId('input-dob-month'), '04');
  fireEvent.changeText(screen.getByTestId('input-dob-year'), '1999');
}

/** From the welcome screen to "who would you like to meet" (or the location step). */
async function throughBasics(purpose: 'dating' | 'life_partner' | 'co_founder'): Promise<void> {
  await screen.findByText('Let’s build your profile');
  await next('What are you here for?');
  fireEvent.press(screen.getByTestId(`choice-purpose-${purpose}`));
  await next('What should people call you?');
  fireEvent.changeText(screen.getByTestId('input-first-name'), 'Saksham');
  await next('When’s your birthday?');
  enterBirthday();
  await next('How do you describe yourself?');
  fireEvent.press(screen.getByTestId('choice-gender-man'));
}

describe('OnboardingScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('the first steps', () => {
    it('opens on the welcome screen for somebody who has not started', async () => {
      renderWizard();

      expect(await screen.findByText('Let’s build your profile')).toBeTruthy();
      expect(isNextDisabled()).toBe(false);
    });

    it('offers exactly three purposes, and not networking', async () => {
      renderWizard();
      await screen.findByText('Let’s build your profile');
      await next('What are you here for?');

      expect(screen.getByTestId('choice-purpose-dating')).toBeTruthy();
      expect(screen.getByTestId('choice-purpose-life_partner')).toBeTruthy();
      expect(screen.getByTestId('choice-purpose-co_founder')).toBeTruthy();
      expect(screen.queryByTestId('choice-purpose-networking')).toBeNull();

      // Nothing chosen yet. A live button here is how somebody ends up three
      // steps in with an empty answer behind them.
      expect(isNextDisabled()).toBe(true);
      fireEvent.press(screen.getByTestId('choice-purpose-life_partner'));
      expect(isNextDisabled()).toBe(false);
    });

    it('offers to sign out from the first step, and says the answers are kept', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { container } = renderWizard();
      const signOut = jest
        .spyOn(container.useCases.signOut, 'execute')
        .mockResolvedValue({ ok: true, value: undefined });

      await screen.findByText('Let’s build your profile');
      fireEvent.press(screen.getByTestId('button-onboarding-back'));

      expect(alert).toHaveBeenCalledTimes(1);
      expect(String(alert.mock.calls[0]?.[1])).toContain('saved');
      expect(signOut).not.toHaveBeenCalled();

      const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
      buttons.find((button) => button.style === 'destructive')?.onPress?.();
      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('saving as it goes', () => {
    it('saves each step with its key, so the flow can resume', async () => {
      const wizard = renderWizard();

      await screen.findByText('Let’s build your profile');
      await next('What are you here for?');
      fireEvent.press(screen.getByTestId('choice-purpose-dating'));
      await next('What should people call you?');

      expect(wizard.profileWrites).toContainEqual({ intents: ['dating'] });
      expect(wizard.preferenceWrites).toContainEqual({ intents: ['dating'] });
      expect(wizard.detailWrites.map((write) => write.onboardingStep)).toEqual([
        'welcome',
        'purpose',
      ]);

      fireEvent.changeText(screen.getByTestId('input-first-name'), 'Saksham');
      fireEvent.changeText(screen.getByTestId('input-last-name'), 'Kulkarni');
      await next('When’s your birthday?');

      expect(wizard.profileWrites).toContainEqual({ name: 'Saksham' });
      // The surname is saved, and hidden unless the member says otherwise.
      // Religion is hidden by default too, before it has even been asked.
      expect(wizard.detailWrites.at(-1)).toMatchObject({
        lastName: 'Kulkarni',
        hiddenFields: ['lastName', 'religion'],
        onboardingStep: 'name',
      });
    });

    it('keeps the member on the step and says why when a save fails', async () => {
      renderWizard({ failDetailsWrites: true });

      await screen.findByText('Let’s build your profile');
      fireEvent.press(nextButton());

      expect(await screen.findByTestId('onboarding-error')).toBeTruthy();
      expect(screen.getByText('Let’s build your profile')).toBeTruthy();
    });

    it('does not present the signup default city as an answer', async () => {
      renderWizard({
        person: {
          ...FRESH,
          name: 'Saksham',
          intents: ['dating'],
          dateOfBirth: '1999-04-12',
          gender: 'man',
        },
        details: { ...EMPTY_PROFILE_DETAILS, onboardingStep: 'interestedIn' },
      });

      expect(await screen.findByText('Where are you based?')).toBeTruthy();
      // The profile row says "Pune" because the signup trigger wrote it, not
      // because the member chose it.
      expect(screen.getByTestId('input-city').props.value).toBe('');
      expect(isNextDisabled()).toBe(true);
    });

    it('keeps the city once the location step has been saved', async () => {
      renderWizard({
        person: {
          ...FRESH,
          name: 'Saksham',
          intents: ['dating'],
          dateOfBirth: '1999-04-12',
          gender: 'man',
        },
        details: { ...EMPTY_PROFILE_DETAILS, onboardingStep: 'location' },
      });

      await screen.findByText('Which languages do you speak?');
      fireEvent.press(screen.getByTestId('button-onboarding-back'));
      expect(screen.getByTestId('input-city').props.value).toBe('Pune');
    });

    it('resumes on the step after the last one saved, with the answers filled in', async () => {
      renderWizard({
        person: { ...FRESH, name: 'Saksham', intents: ['dating'], dateOfBirth: '1999-04-12' },
        details: { ...EMPTY_PROFILE_DETAILS, onboardingStep: 'birthday' },
      });

      expect(await screen.findByText('How do you describe yourself?')).toBeTruthy();

      fireEvent.press(screen.getByTestId('button-onboarding-back'));
      expect(screen.getByText('When’s your birthday?')).toBeTruthy();
      fireEvent.press(screen.getByTestId('button-onboarding-back'));
      expect(screen.getByTestId('input-first-name').props.value).toBe('Saksham');
    });
  });

  describe('questions that depend on earlier answers', () => {
    it('asks who you want to meet when dating', async () => {
      renderWizard();
      await throughBasics('dating');
      await next('Who would you like to meet?');
    });

    it('does not ask who you want to meet for a co-founder search', async () => {
      const wizard = renderWizard();
      await throughBasics('co_founder');
      await next('Where are you based?');

      expect(screen.queryByText('Who would you like to meet?')).toBeNull();
      // Cleared rather than left over from an earlier romantic answer.
      expect(wizard.preferenceWrites).toContainEqual({ intents: ['co_founder'], interestedIn: [] });
    });

    it('asks about studies, and not work, for a student', async () => {
      renderWizard({
        person: {
          ...FRESH,
          name: 'Saksham',
          intents: ['co_founder'],
          dateOfBirth: '1999-04-12',
          gender: 'man',
        },
        details: { ...EMPTY_PROFILE_DETAILS, onboardingStep: 'languages' },
      });

      expect(await screen.findByText('What are you up to these days?')).toBeTruthy();
      fireEvent.press(screen.getByTestId('choice-status-studying'));
      await next('What are you studying?');
      await next('A bit more about your studies');
      await next('A few lifestyle questions');
      expect(screen.queryByText('What do you do?')).toBeNull();
    });

    it('asks about both for somebody working and studying', async () => {
      renderWizard({
        person: {
          ...FRESH,
          name: 'Saksham',
          intents: ['co_founder'],
          dateOfBirth: '1999-04-12',
          gender: 'man',
        },
        details: { ...EMPTY_PROFILE_DETAILS, onboardingStep: 'languages' },
      });

      await screen.findByText('What are you up to these days?');
      fireEvent.press(screen.getByTestId('choice-status-both'));
      await next('What are you studying?');
      await next('A bit more about your studies');
      await next('What do you do?');
    });

    it('refuses a graduation year that is not a number', async () => {
      renderWizard({
        details: {
          ...EMPTY_PROFILE_DETAILS,
          occupationStatus: 'working',
          onboardingStep: 'status',
        },
      });

      await screen.findByText('Your education');
      fireEvent.changeText(screen.getByTestId('input-graduation-year'), '20x9');
      expect(isNextDisabled()).toBe(true);
      fireEvent.changeText(screen.getByTestId('input-graduation-year'), '2019');
      expect(isNextDisabled()).toBe(false);
    });
  });

  describe('photos', () => {
    it('holds the next button until there are two photos', async () => {
      renderWizard({
        details: { ...EMPTY_PROFILE_DETAILS, onboardingStep: 'prompts' },
        photos: [photo('a', 1)],
      });

      expect(await screen.findByText('Add your photos')).toBeTruthy();
      await waitFor(() => expect(screen.getByTestId('photo-count')).toBeTruthy());
      expect(isNextDisabled()).toBe(true);
    });

    it('allows continuing with two', async () => {
      renderWizard({
        details: { ...EMPTY_PROFILE_DETAILS, onboardingStep: 'prompts' },
        photos: [photo('a', 1), photo('b', 2)],
      });

      await screen.findByText('Add your photos');
      await waitFor(() => expect(isNextDisabled()).toBe(false));
    });
  });

  describe('category questions', () => {
    const at = (
      purpose: 'dating' | 'life_partner' | 'co_founder',
      step = 'verification',
    ): Setup => ({
      person: {
        ...FRESH,
        name: 'Saksham',
        intents: [purpose],
        dateOfBirth: '1999-04-12',
        gender: 'man',
      },
      details: { ...EMPTY_PROFILE_DETAILS, occupationStatus: 'working', onboardingStep: step },
    });

    it('asks the dating questions after verification, and only those', async () => {
      const wizard = renderWizard(at('dating'));

      expect(await screen.findByText('What are you looking for?')).toBeTruthy();
      expect(screen.getByTestId('onboarding-section').props.children).toContain('DATING');
      expect(isNextDisabled()).toBe(true);

      fireEvent.press(screen.getByTestId('choice-goal-long_term'));
      await next('A little more');
      expect(wizard.detailWrites.at(-1)).toEqual({
        relationshipGoal: 'long_term',
        onboardingStep: 'datingGoal',
      });

      fireEvent.press(screen.getByTestId('option-partner-values-kindness'));
      fireEvent.press(screen.getByTestId('option-partner-values-humour'));
      await next('Who should we show you?');
      expect(wizard.detailWrites.at(-1)).toMatchObject({
        partnerValues: ['kindness', 'humour'],
        onboardingStep: 'datingMore',
      });
      expect(screen.queryByText('Marriage basics')).toBeNull();
    });

    it('caps "what matters most" at three', async () => {
      renderWizard(at('dating', 'datingGoal'));

      await screen.findByText('A little more');
      for (const value of ['kindness', 'humour', 'ambition'] as const) {
        fireEvent.press(screen.getByTestId(`option-partner-values-${value}`));
      }
      expect(
        screen.getByTestId('option-partner-values-honesty').props.accessibilityState.disabled,
      ).toBe(true);
    });

    it('needs both marriage basics, and keeps religion private unless shown', async () => {
      const wizard = renderWizard(at('life_partner'));

      expect(await screen.findByText('Marriage basics')).toBeTruthy();
      fireEvent.press(screen.getByTestId('option-marriage-timeline-within_1_year'));
      expect(isNextDisabled()).toBe(true);
      fireEvent.press(screen.getByTestId('option-marital-status-never_married'));
      await next('Family & faith');

      expect(screen.queryByTestId('toggle-show-religion')).toBeNull();
      fireEvent.press(screen.getByTestId('option-religion-hindu'));
      expect(screen.getByTestId('toggle-show-religion').props.value).toBe(false);

      await next('Who should we show you?');
      const saved = wizard.detailWrites.at(-1);
      expect(saved).toMatchObject({ religion: 'hindu', onboardingStep: 'familyFaith' });
      expect(saved?.hiddenFields).toContain('religion');
    });

    it('asks a co-founder about both sides, and the stage only if they have a startup', async () => {
      const wizard = renderWizard(at('co_founder'));

      expect(await screen.findByText('Your side of the startup')).toBeTruthy();
      expect(screen.queryByTestId('option-startup-stage')).toBeNull();

      fireEvent.press(screen.getByTestId('choice-cofounder-role-have_startup'));
      expect(screen.getByTestId('option-startup-stage')).toBeTruthy();
      fireEvent.press(screen.getByTestId('option-startup-stage-prototype'));
      expect(isNextDisabled()).toBe(true);
      fireEvent.press(screen.getByTestId('option-commitment-full_time_now'));
      await next('Who are you looking for?');

      expect(wizard.detailWrites.at(-1)).toMatchObject({
        cofounderRole: 'have_startup',
        startupStage: 'prototype',
        founderCommitment: 'full_time_now',
      });

      expect(isNextDisabled()).toBe(true);
      fireEvent.press(screen.getByTestId('option-seeking-skills-engineering'));
      await next('Who should we show you?');
      expect(wizard.detailWrites.at(-1)).toMatchObject({ seekingSkills: ['engineering'] });
    });

    it('resumes inside the category questions', async () => {
      renderWizard(at('co_founder', 'founderSide'));

      expect(await screen.findByText('Who are you looking for?')).toBeTruthy();
    });
  });

  describe('finishing', () => {
    const complete: Setup = {
      person: {
        ...FRESH,
        name: 'Saksham',
        intents: ['dating'],
        dateOfBirth: '1999-04-12',
        gender: 'man',
        city: 'Pune',
        interests: ['Coffee', 'Books', 'Startups'],
        bio: 'Designs for a fintech and runs on weekends.',
      },
      details: {
        ...EMPTY_PROFILE_DETAILS,
        occupationStatus: 'working',
        jobTitle: 'Designer',
        relationshipGoal: 'long_term',
        onboardingStep: 'notifications',
      },
      photos: [photo('a', 1), photo('b', 2)],
    };

    it('shows the preview, and finishing marks onboarding complete', async () => {
      const wizard = renderWizard(complete);

      expect(await screen.findByText('Here’s your profile')).toBeTruthy();
      expect(screen.getByTestId('profile-completeness')).toBeTruthy();

      fireEvent.press(nextButton());

      expect(await screen.findByTestId('screen-onboarding-done')).toBeTruthy();
      expect(wizard.completedCount()).toBe(1);
    });

    it('goes to a section from the preview and comes back to it', async () => {
      renderWizard(complete);

      await screen.findByText('Here’s your profile');
      fireEvent.press(screen.getByTestId('button-edit-lifestyle'));
      await screen.findByText('A few lifestyle questions');
      fireEvent.press(screen.getByTestId('option-smoking-never'));

      await next('Here’s your profile');
      expect(screen.getByText('Never')).toBeTruthy();
    });

    it('does not rewind saved progress when a section is edited from the preview', async () => {
      const wizard = renderWizard(complete);

      await screen.findByText('Here’s your profile');
      fireEvent.press(await screen.findByTestId('button-edit-lifestyle'));
      await screen.findByText('A few lifestyle questions');
      fireEvent.press(screen.getByTestId('option-smoking-never'));
      await next('Here’s your profile');

      // Saved at the furthest step reached, not at "lifestyle": closing the
      // app here resumes on the preview, not half-way through the flow.
      expect(wizard.detailWrites.at(-1)).toMatchObject({
        smoking: 'never',
        onboardingStep: 'notifications',
      });
      expect(await screen.findByText('Never')).toBeTruthy();
    });

    it('shows what is saved, not an edit the member backed out of', async () => {
      renderWizard(complete);

      await screen.findByText('Here’s your profile');
      fireEvent.press(await screen.findByTestId('button-edit-lifestyle'));
      await screen.findByText('A few lifestyle questions');
      fireEvent.press(screen.getByTestId('option-smoking-never'));
      fireEvent.press(screen.getByTestId('button-onboarding-back'));

      await screen.findByText('Here’s your profile');
      await screen.findByTestId('profile-completeness');
      expect(screen.queryByText('Never')).toBeNull();

      // Not thrown away either: it is still there to save on the way back in.
      fireEvent.press(screen.getByTestId('button-edit-lifestyle'));
      await screen.findByText('A few lifestyle questions');
      expect(screen.getByTestId('option-smoking-never').props.accessibilityState.checked).toBe(
        true,
      );
    });

    it('edits every step of a section before returning to the preview', async () => {
      renderWizard(complete);

      await screen.findByText('Here’s your profile');
      fireEvent.press(await screen.findByTestId('button-edit-about-you'));
      await screen.findByText('What are you into?');
      fireEvent.press(nextButton());
      // "Introduce yourself" is both the question and the field's label.
      expect(await screen.findByTestId('input-bio')).toBeTruthy();
      await next('Pick a prompt or two');
      await next('Here’s your profile');
    });

    it('carries on through the new questions when the purpose is changed from the preview', async () => {
      renderWizard(complete);

      await screen.findByText('Here’s your profile');
      fireEvent.press(await screen.findByTestId('button-edit-purpose'));
      await screen.findByText('What are you here for?');
      fireEvent.press(screen.getByTestId('choice-purpose-co_founder'));

      // Not straight back to the preview: the co-founder questions are ahead.
      await next('What should people call you?');
    });

    it('sends the member to what is missing instead of finishing', async () => {
      const wizard = renderWizard({ ...complete, photos: [photo('a', 1)] });

      await screen.findByText('Here’s your profile');
      fireEvent.press(nextButton());

      expect(await screen.findByText('Add your photos')).toBeTruthy();
      expect(screen.getByTestId('onboarding-error')).toBeTruthy();
      expect(wizard.completedCount()).toBe(0);
    });
  });
});
