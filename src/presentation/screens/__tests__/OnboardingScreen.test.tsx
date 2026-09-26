import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { createTestContainer } from '@/app/di';
import { AppProviders, createTestQueryClient } from '@/app/providers';
import { DEFAULT_PREFERENCES, type Person, type PreferencesUpdate } from '@/domain/entities';
import {
  success,
  type PreferencesRepository,
  type ProfileRepository,
  type ProfileUpdate,
} from '@/domain/repositories';
import { OnboardingScreen } from '@/presentation/screens';

/**
 * The onboarding wizard.
 *
 * What is being tested is the flow, not the styling: that the next button
 * refuses an unanswered question, that a conditional step appears only when it
 * applies, and that what the member typed is what reaches the repository.
 *
 * No Supabase, no mocking framework, no native modules. Two hand-written
 * repositories record what they are handed — which is the whole point of the
 * repositories being interfaces.
 */

const BASE: Person = {
  id: 'person-1',
  name: 'New member',
  headline: '',
  city: 'Pune',
  photoUrls: [],
  interests: [],
  intents: [],
  verification: 'unverified',
};

function recordingRepositories() {
  const profileWrites: ProfileUpdate[] = [];
  const preferenceWrites: PreferencesUpdate[] = [];

  const profile: ProfileRepository = {
    getMyProfile: async () => success(BASE),
    getProfileById: async () => success(BASE),
    updateMyProfile: async (update) => {
      profileWrites.push(update);
      return success({ ...BASE, ...update } as Person);
    },
  };

  const preferences: PreferencesRepository = {
    getMyPreferences: async () => success(DEFAULT_PREFERENCES),
    updateMyPreferences: async (update) => {
      preferenceWrites.push(update);
      return success({ ...DEFAULT_PREFERENCES, ...update });
    },
  };

  return { profile, preferences, profileWrites, preferenceWrites };
}

function renderWizard() {
  const repositories = recordingRepositories();
  const container = createTestContainer({
    repositories: { profile: repositories.profile, preferences: repositories.preferences },
  });

  return {
    ...repositories,
    container,
    ...render(
      <AppProviders container={container} queryClient={createTestQueryClient()}>
        <OnboardingScreen />
      </AppProviders>,
    ),
  };
}

const next = (): void => fireEvent.press(screen.getByTestId('button-onboarding-next'));

/** Fills in a birthday that is comfortably over eighteen. */
function enterBirthday(): void {
  fireEvent.changeText(screen.getByTestId('input-dob-day'), '12');
  fireEvent.changeText(screen.getByTestId('input-dob-month'), '04');
  fireEvent.changeText(screen.getByTestId('input-dob-year'), '1999');
}

describe('OnboardingScreen', () => {
  describe('back from the first question', () => {
    afterEach(() => jest.restoreAllMocks());

    it('offers to sign out, and signs out when confirmed', () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { container } = renderWizard();
      const signOut = jest
        .spyOn(container.useCases.signOut, 'execute')
        .mockResolvedValue({ ok: true, value: undefined });

      fireEvent.press(screen.getByTestId('button-onboarding-back'));

      // Asked first: leaving loses every answer so far.
      expect(alert).toHaveBeenCalledTimes(1);
      expect(signOut).not.toHaveBeenCalled();

      const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
      buttons.find((button) => button.style === 'destructive')?.onPress?.();

      expect(signOut).toHaveBeenCalledTimes(1);
    });

    it('stays put when the member cancels', () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { container } = renderWizard();
      const signOut = jest.spyOn(container.useCases.signOut, 'execute');

      fireEvent.press(screen.getByTestId('button-onboarding-back'));
      const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
      buttons.find((button) => button.style === 'cancel')?.onPress?.();

      expect(signOut).not.toHaveBeenCalled();
      expect(screen.getByText('What brings you to Offtexts?')).toBeTruthy();
    });
  });

  it('starts on the purpose question with the next button disabled', () => {
    renderWizard();

    expect(screen.getByText('What brings you to Offtexts?')).toBeTruthy();
    // Nothing chosen yet. A live button here is how somebody ends up three
    // steps in with an empty answer behind them.
    expect(screen.getByTestId('button-onboarding-next').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('enables the next button once the question is answered', () => {
    renderWizard();

    fireEvent.press(screen.getByTestId('choice-purpose-dating'));

    expect(screen.getByTestId('button-onboarding-next').props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('asks who you want to meet when the purpose is dating', () => {
    renderWizard();

    fireEvent.press(screen.getByTestId('choice-purpose-dating'));
    next();
    fireEvent.changeText(screen.getByTestId('input-name'), 'Saksham');
    next();
    enterBirthday();
    next();
    fireEvent.press(screen.getByTestId('choice-gender-man'));
    next();

    expect(screen.getByText('Who would you like to meet?')).toBeTruthy();
  });

  it('does not ask who you want to meet when the purpose is a co-founder', () => {
    renderWizard();

    fireEvent.press(screen.getByTestId('choice-purpose-co_founder'));
    next();
    fireEvent.changeText(screen.getByTestId('input-name'), 'Saksham');
    next();
    enterBirthday();
    next();
    fireEvent.press(screen.getByTestId('choice-gender-man'));
    next();

    // Straight to the city. Filtering a co-founder search by gender would be
    // doing something nobody asked for.
    expect(screen.queryByText('Who would you like to meet?')).toBeNull();
    expect(screen.getByText('Which city?')).toBeTruthy();
  });

  it('refuses a birthday under eighteen and says so', () => {
    renderWizard();

    fireEvent.press(screen.getByTestId('choice-purpose-dating'));
    next();
    fireEvent.changeText(screen.getByTestId('input-name'), 'Saksham');
    next();

    const thisYear = new Date().getFullYear();
    fireEvent.changeText(screen.getByTestId('input-dob-day'), '12');
    fireEvent.changeText(screen.getByTestId('input-dob-month'), '04');
    fireEvent.changeText(screen.getByTestId('input-dob-year'), String(thisYear - 15));

    expect(screen.getByTestId('dob-feedback').props.children).toContain('18');
    expect(screen.getByTestId('button-onboarding-next').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('refuses a date that does not exist', () => {
    renderWizard();

    fireEvent.press(screen.getByTestId('choice-purpose-dating'));
    next();
    fireEvent.changeText(screen.getByTestId('input-name'), 'Saksham');
    next();

    // 31 February. `new Date(1999, 1, 31)` rolls silently forward to 3 March,
    // so without the round-trip check this would be accepted as a real date.
    fireEvent.changeText(screen.getByTestId('input-dob-day'), '31');
    fireEvent.changeText(screen.getByTestId('input-dob-month'), '02');
    fireEvent.changeText(screen.getByTestId('input-dob-year'), '1999');

    expect(screen.getByTestId('dob-feedback').props.children).toContain('does not exist');
  });

  it('holds the next button until enough interests are chosen', () => {
    renderWizard();

    fireEvent.press(screen.getByTestId('choice-purpose-networking'));
    next();
    fireEvent.changeText(screen.getByTestId('input-name'), 'Saksham');
    next();
    enterBirthday();
    next();
    fireEvent.press(screen.getByTestId('choice-gender-man'));
    next();
    fireEvent.changeText(screen.getByTestId('input-city'), 'Pune');
    next();

    expect(screen.getByText('What are you into?')).toBeTruthy();

    fireEvent.press(screen.getByTestId('chip-interest-Coffee'));
    fireEvent.press(screen.getByTestId('chip-interest-Books'));
    expect(screen.getByTestId('button-onboarding-next').props.accessibilityState.disabled).toBe(
      true,
    );

    fireEvent.press(screen.getByTestId('chip-interest-Startups'));
    expect(screen.getByTestId('button-onboarding-next').props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('writes the answers to the profile and the preferences, and shows the done screen', async () => {
    const wizard = renderWizard();

    fireEvent.press(screen.getByTestId('choice-purpose-networking'));
    next();
    fireEvent.changeText(screen.getByTestId('input-name'), 'Saksham');
    next();
    enterBirthday();
    next();
    fireEvent.press(screen.getByTestId('choice-gender-man'));
    next();
    fireEvent.changeText(screen.getByTestId('input-city'), 'Pune');
    next();
    fireEvent.press(screen.getByTestId('chip-interest-Coffee'));
    fireEvent.press(screen.getByTestId('chip-interest-Books'));
    fireEvent.press(screen.getByTestId('chip-interest-Startups'));
    next();
    fireEvent.changeText(screen.getByTestId('input-headline'), 'Would rather meet than message.');
    next();
    // Bio — optional, skipped.
    next();
    // Photos — optional, and there is no camera roll under Jest.
    next();
    fireEvent.press(screen.getByTestId('choice-guidelines'));
    next();
    fireEvent.press(screen.getByTestId('choice-push-on'));
    next();

    await waitFor(() => expect(screen.getByTestId('screen-onboarding-done')).toBeTruthy());

    expect(wizard.profileWrites).toHaveLength(1);
    expect(wizard.profileWrites[0]).toMatchObject({
      name: 'Saksham',
      dateOfBirth: '1999-04-12',
      gender: 'man',
      city: 'Pune',
      headline: 'Would rather meet than message.',
      interests: ['Coffee', 'Books', 'Startups'],
      intents: ['networking'],
    });

    expect(wizard.preferenceWrites[0]).toMatchObject({
      intents: ['networking'],
      cities: ['Pune'],
      pushEnabled: true,
    });
    // Never asked, so never sent. An empty array would mean "no preference" to
    // the database, which is a different statement from "we did not ask".
    expect(wizard.preferenceWrites[0]).not.toHaveProperty('interestedIn');
  });

  it('lets the member go back and change an answer', () => {
    renderWizard();

    fireEvent.press(screen.getByTestId('choice-purpose-dating'));
    next();
    fireEvent.changeText(screen.getByTestId('input-name'), 'Saksham');
    next();

    fireEvent.press(screen.getByTestId('button-onboarding-back'));
    expect(screen.getByTestId('input-name').props.value).toBe('Saksham');

    fireEvent.press(screen.getByTestId('button-onboarding-back'));
    // Back on the first step. Its back arrow leaves onboarding by signing out,
    // which is covered in "back from the first question".
    expect(screen.getByText('What brings you to Offtexts?')).toBeTruthy();
    expect(screen.getByTestId('button-onboarding-back')).toBeTruthy();
  });

  it('drops a stale answer when the purpose changes', () => {
    renderWizard();

    fireEvent.press(screen.getByTestId('choice-purpose-dating'));
    next();
    fireEvent.changeText(screen.getByTestId('input-name'), 'Saksham');
    next();
    enterBirthday();
    next();
    fireEvent.press(screen.getByTestId('choice-gender-man'));
    next();
    fireEvent.press(screen.getByTestId('choice-interested-woman'));

    // All the way back to the first question and on to a purpose where the
    // question does not apply.
    fireEvent.press(screen.getByTestId('button-onboarding-back'));
    fireEvent.press(screen.getByTestId('button-onboarding-back'));
    fireEvent.press(screen.getByTestId('button-onboarding-back'));
    fireEvent.press(screen.getByTestId('button-onboarding-back'));
    fireEvent.press(screen.getByTestId('choice-purpose-co_founder'));
    next();
    next();
    next();
    next();

    // The old answer must not be carried into a search it would silently
    // narrow.
    expect(screen.getByText('Which city?')).toBeTruthy();
  });
});
