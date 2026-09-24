import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Chip,
  ChipGroup,
  ChoiceRow,
  DateOfBirthField,
  InterestPicker,
  PhotoGrid,
  Spacer,
  TextField,
} from '@/presentation/components';
import { usePhotoUpload } from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
import {
  GENDERS,
  GENDER_LABELS,
  GENDER_PLURAL_LABELS,
  MEET_INTENTS,
  MEET_INTENT_DESCRIPTIONS,
  MEET_INTENT_LABELS,
  MIN_AGE,
  PREFERABLE_GENDERS,
  type Gender,
} from '@/domain/entities';
import { ONBOARDING_LIMITS } from '@/domain/usecases';
import { COMMUNITY_GUIDELINES, SUGGESTED_CITIES } from '@/shared/constants/app';
import type { OnboardingDraft } from './draft';

/**
 * THE QUESTIONS.
 *
 * This file is the onboarding flow. Reordering it reorders the flow; deleting
 * an entry removes a question; adding one adds a screen. There is no other
 * place to look, and no fifteen near-identical components to keep in step.
 *
 * WHAT IS NOT ASKED, AND WHY
 * Job title, height, "what are you looking for" in prose, drinking, smoking —
 * all things a dating app asks and all things this schema has nowhere to put.
 * Asking for an answer the database will drop is worse than not asking: the
 * member spends the effort, sees it accepted, and it is gone. Those questions
 * arrive when migration 0011 gives them a column, and not before.
 */

export type StepContext = {
  draft: OnboardingDraft;
  patch: (update: Partial<OnboardingDraft>) => void;
};

export type StepConfig = {
  /** Stable id. Used as a React key and in test ids. */
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  question: string;
  subtitle?: string;
  privacy?: { text: string; visibility: 'shown' | 'hidden' };
  /** When present and false, the step is left out of the flow entirely. */
  applies?: (draft: OnboardingDraft) => boolean;
  /** The next button stays grey until this is true. */
  isAnswered: (draft: OnboardingDraft) => boolean;
  /** Offers a "Skip" link. Only ever on steps whose answer is genuinely optional. */
  skippable?: boolean;
  Body: (props: StepContext) => React.JSX.Element;
};

/* ---------------------------------------------------------------- bodies -- */

function PurposeBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[12] }}>
      {MEET_INTENTS.map((intent) => (
        <ChoiceRow
          key={intent}
          label={MEET_INTENT_LABELS[intent]}
          description={MEET_INTENT_DESCRIPTIONS[intent]}
          selected={draft.purpose === intent}
          // Choosing a different purpose clears who you want to meet: the
          // question is only asked for some purposes, and a co-founder search
          // carrying a gender preference from an abandoned dating answer would
          // filter people out for a reason nobody chose.
          onPress={() => patch({ purpose: intent, interestedIn: [] })}
          testID={`choice-purpose-${intent}`}
        />
      ))}
    </View>
  );
}

function NameBody({ draft, patch }: StepContext): React.JSX.Element {
  return (
    <TextField
      label="First name"
      value={draft.name}
      onChangeText={(name) => patch({ name })}
      placeholder="Saksham"
      autoCapitalize="words"
      autoCorrect={false}
      maxLength={ONBOARDING_LIMITS.name.max}
      textContentType="givenName"
      returnKeyType="done"
      testID="input-name"
    />
  );
}

function BirthdayBody({ draft, patch }: StepContext): React.JSX.Element {
  return (
    <DateOfBirthField
      value={draft.dateOfBirth}
      onChange={(dateOfBirth) => patch({ dateOfBirth })}
      minimumAge={MIN_AGE}
    />
  );
}

function GenderBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[12] }}>
      {GENDERS.map((gender) => (
        <ChoiceRow
          key={gender}
          label={GENDER_LABELS[gender]}
          selected={draft.gender === gender}
          onPress={() => patch({ gender })}
          testID={`choice-gender-${gender}`}
        />
      ))}
    </View>
  );
}

function InterestedInBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();

  const toggle = (gender: Gender): void => {
    const next = draft.interestedIn.includes(gender)
      ? draft.interestedIn.filter((value) => value !== gender)
      : [...draft.interestedIn, gender];
    patch({ interestedIn: next });
  };

  return (
    <View style={{ gap: theme.spacing[12] }}>
      {PREFERABLE_GENDERS.map((gender) => (
        <ChoiceRow
          key={gender}
          label={GENDER_PLURAL_LABELS[gender]}
          selected={draft.interestedIn.includes(gender)}
          onPress={() => toggle(gender)}
          mode="multiple"
          testID={`choice-interested-${gender}`}
        />
      ))}
      <AppText variant="caption" color="textSecondary">
        Pick as many as apply. You can change this later without anyone being told.
      </AppText>
    </View>
  );
}

function CityBody({ draft, patch }: StepContext): React.JSX.Element {
  return (
    <>
      <TextField
        label="City"
        value={draft.city}
        onChangeText={(city) => patch({ city })}
        placeholder="Pune"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        testID="input-city"
      />
      <Spacer size={16} />
      <AppText variant="caption" color="textSecondary">
        Where we have cafés today
      </AppText>
      <Spacer size={8} />
      <ChipGroup>
        {SUGGESTED_CITIES.map((city) => (
          <Chip
            key={city}
            label={city}
            selected={draft.city.trim().toLowerCase() === city.toLowerCase()}
            onPress={() => patch({ city })}
            testID={`chip-city-${city}`}
          />
        ))}
      </ChipGroup>
    </>
  );
}

function InterestsBody({ draft, patch }: StepContext): React.JSX.Element {
  return (
    <InterestPicker
      selected={draft.interests}
      onChange={(interests) => patch({ interests })}
      min={ONBOARDING_LIMITS.interests.min}
      max={ONBOARDING_LIMITS.interests.max}
    />
  );
}

function HeadlineBody({ draft, patch }: StepContext): React.JSX.Element {
  const remaining = ONBOARDING_LIMITS.headline.max - draft.headline.length;
  return (
    <>
      <TextField
        label="Your line"
        value={draft.headline}
        onChangeText={(headline) => patch({ headline })}
        placeholder="Would rather meet than message."
        multiline
        numberOfLines={3}
        maxLength={ONBOARDING_LIMITS.headline.max}
        autoCapitalize="sentences"
        testID="input-headline"
      />
      <Spacer size={8} />
      <AppText variant="caption" color={remaining < 20 ? 'warning' : 'textSecondary'}>
        {`${remaining} characters left`}
      </AppText>
    </>
  );
}

function BioBody({ draft, patch }: StepContext): React.JSX.Element {
  return (
    <TextField
      label="A bit more"
      value={draft.bio}
      onChangeText={(bio) => patch({ bio })}
      placeholder="What you do, what you are into, what a good Saturday looks like."
      multiline
      numberOfLines={6}
      maxLength={ONBOARDING_LIMITS.bio.max}
      autoCapitalize="sentences"
      hint="Optional, and easy to add later."
      testID="input-bio"
    />
  );
}

/**
 * The one step that writes as it goes.
 *
 * Everything else in this wizard is held in the draft and saved once at the
 * end, for the reason set out on `OnboardingScreen`. Photos cannot be: the file
 * has already left the phone and is sitting in the bucket the moment it is
 * picked, so the only choice is whether the row that points at it exists. A
 * file with no row is an orphan nobody can find or delete.
 *
 * Abandoning the wizard therefore leaves photos behind — attached to the
 * profile row the signup trigger already created, waiting for whenever the
 * member comes back. That is the better of the two outcomes.
 */
function PhotosBody(_props: StepContext): React.JSX.Element {
  const photos = usePhotoUpload();

  return (
    <>
      <PhotoGrid
        photos={photos.photos}
        onAdd={() => {
          void photos.add();
        }}
        onRemove={(id) => {
          void photos.remove(id);
        }}
        busy={photos.isBusy}
        canPick={photos.canPick}
      />

      {photos.error ? (
        <>
          <Spacer size={16} />
          <AppText variant="caption" color="danger" testID="photo-error">
            {photos.error}
          </AppText>
        </>
      ) : null}

      {!photos.canPick ? (
        <>
          <Spacer size={16} />
          <AppText variant="caption" color="textSecondary">
            Adding photos needs the app on a phone. You can do it from your profile later.
          </AppText>
        </>
      ) : null}
    </>
  );
}

function GuidelinesBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();

  return (
    <>
      <View style={{ gap: theme.spacing[20] }}>
        {COMMUNITY_GUIDELINES.map((rule) => (
          <View key={rule.title} style={[styles.rule, { gap: theme.spacing[12] }]}>
            <Ionicons name={rule.icon} size={22} color={theme.colors.primary} />
            <View style={styles.grow}>
              <AppText variant="bodyStrong">{rule.title}</AppText>
              <AppText
                variant="caption"
                color="textSecondary"
                style={{ marginTop: theme.spacing[2] }}
              >
                {rule.body}
              </AppText>
            </View>
          </View>
        ))}
      </View>

      <Spacer size={24} />
      <ChoiceRow
        label="I’ll keep to this"
        selected={draft.agreedToGuidelines}
        onPress={() => patch({ agreedToGuidelines: !draft.agreedToGuidelines })}
        mode="multiple"
        testID="choice-guidelines"
      />
    </>
  );
}

function NotificationsBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[12] }}>
      <ChoiceRow
        label="Yes, tell me"
        description="Three new people each morning, and the moment somebody you liked likes you back."
        selected={draft.pushEnabled === true}
        onPress={() => patch({ pushEnabled: true })}
        icon="notifications-outline"
        testID="choice-push-on"
      />
      <ChoiceRow
        label="No, I’ll check myself"
        description="Nothing will be sent. You can turn this on from your profile whenever you like."
        selected={draft.pushEnabled === false}
        onPress={() => patch({ pushEnabled: false })}
        icon="moon-outline"
        testID="choice-push-off"
      />
    </View>
  );
}

/* ----------------------------------------------------------------- steps -- */

/** Purposes where "who would you like to meet" is a sensible question to ask. */
const ROMANTIC_PURPOSES = new Set(['dating', 'life_partner']);

export const ONBOARDING_STEPS: StepConfig[] = [
  {
    key: 'purpose',
    icon: 'sparkles-outline',
    question: 'What brings you to Offtexts?',
    subtitle: 'It decides who you are shown, and who is shown you.',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    isAnswered: (draft) => draft.purpose !== null,
    Body: PurposeBody,
  },
  {
    key: 'name',
    icon: 'person-outline',
    question: 'What should people call you?',
    subtitle: 'First name is enough. It is what appears on your card.',
    privacy: { text: 'Shown to everyone you are matched with.', visibility: 'shown' },
    isAnswered: (draft) => draft.name.trim().length >= ONBOARDING_LIMITS.name.min,
    Body: NameBody,
  },
  {
    key: 'birthday',
    icon: 'gift-outline',
    question: 'When’s your birthday?',
    subtitle: 'So nobody has to ask, and so we can keep this an adults-only app.',
    privacy: { text: 'Never shown. Only your age appears.', visibility: 'hidden' },
    isAnswered: (draft) => draft.dateOfBirth !== null,
    Body: BirthdayBody,
  },
  {
    key: 'gender',
    icon: 'people-outline',
    question: 'How do you describe yourself?',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    isAnswered: (draft) => draft.gender !== null,
    Body: GenderBody,
  },
  {
    key: 'interestedIn',
    icon: 'heart-outline',
    question: 'Who would you like to meet?',
    // Only asked where it means something. A co-founder search that filtered by
    // gender would be doing something nobody asked it to do.
    applies: (draft) => draft.purpose !== null && ROMANTIC_PURPOSES.has(draft.purpose),
    privacy: { text: 'Never shown to anybody. It only filters who you see.', visibility: 'hidden' },
    isAnswered: (draft) => draft.interestedIn.length > 0,
    Body: InterestedInBody,
  },
  {
    key: 'city',
    icon: 'location-outline',
    question: 'Which city?',
    subtitle: 'Meets happen at a café, so this one actually matters.',
    privacy: { text: 'Shown on your profile. Never your exact location.', visibility: 'shown' },
    isAnswered: (draft) => draft.city.trim().length > 1,
    Body: CityBody,
  },
  {
    key: 'interests',
    icon: 'pricetags-outline',
    question: 'What are you into?',
    subtitle: 'This is what the first ten minutes of coffee gets spent on.',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    isAnswered: (draft) =>
      draft.interests.length >= ONBOARDING_LIMITS.interests.min &&
      draft.interests.length <= ONBOARDING_LIMITS.interests.max,
    Body: InterestsBody,
  },
  {
    key: 'headline',
    icon: 'chatbubble-ellipses-outline',
    question: 'One line about you',
    subtitle: 'The line under your name. Say something only you would say.',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    isAnswered: (draft) => draft.headline.trim().length > 0,
    Body: HeadlineBody,
  },
  {
    key: 'bio',
    icon: 'book-outline',
    question: 'Anything else worth knowing?',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    // Genuinely optional, so the next button is live from the start and there
    // is a skip link as well.
    isAnswered: () => true,
    skippable: true,
    Body: BioBody,
  },
  {
    key: 'photos',
    icon: 'camera-outline',
    question: 'Add a photo or two',
    subtitle: 'The first one is what people see. A real, recent face does better than a good one.',
    privacy: { text: 'Shown on your profile once a moderator has seen it.', visibility: 'shown' },
    isAnswered: () => true,
    skippable: true,
    Body: PhotosBody,
  },
  {
    key: 'guidelines',
    icon: 'shield-checkmark-outline',
    question: 'How this works',
    subtitle: 'Four things everybody here has agreed to.',
    isAnswered: (draft) => draft.agreedToGuidelines,
    Body: GuidelinesBody,
  },
  {
    key: 'notifications',
    icon: 'notifications-outline',
    question: 'Want to know when something happens?',
    subtitle: 'There is no chat here, so this is the only way we would reach you.',
    privacy: { text: 'You can change this at any time.', visibility: 'hidden' },
    isAnswered: (draft) => draft.pushEnabled !== null,
    Body: NotificationsBody,
  },
];

/** The steps that apply to this draft, in order. */
export function visibleSteps(draft: OnboardingDraft): StepConfig[] {
  return ONBOARDING_STEPS.filter((step) => (step.applies ? step.applies(draft) : true));
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  rule: { flexDirection: 'row', alignItems: 'flex-start' },
});
