import type { Ionicons } from '@expo/vector-icons';
import type React from 'react';

import {
  MIN_PHOTOS,
  isRomanticIntent,
  isStudying,
  isWorking,
  type SelectableIntent,
} from '@/domain/entities';
import { ONBOARDING_LIMITS, type OnboardingStepSave } from '@/domain/usecases';
import { InterestsBody, IntroBody, PromptsBody } from './bodies/about';
import {
  EducationBody,
  LifestyleBody,
  StatusBody,
  StudiesBody,
  WorkBody,
} from './bodies/background';
import {
  BirthdayBody,
  GenderBody,
  InterestedInBody,
  LanguagesBody,
  LocationBody,
  NameBody,
  PurposeBody,
  WelcomeBody,
} from './bodies/basics';
import {
  GuidelinesBody,
  NotificationsBody,
  PreferencesBody,
  PreviewBody,
  VerificationBody,
} from './bodies/finish';
import {
  DatingGoalBody,
  DatingMoreBody,
  FamilyFaithBody,
  FounderSeekingBody,
  FounderSideBody,
  MarriageBasicsBody,
} from './bodies/category';
import { PhotosBody } from './bodies/photos';
import {
  hiddenFieldsOf,
  isWholeNumberOrBlank,
  textOrNull,
  wholeNumberOrNull,
  type OnboardingDraft,
} from './draft';

/**
 * THE QUESTIONS.
 *
 * This file is the onboarding flow. Reordering it reorders the flow; deleting
 * an entry removes a question; adding one adds a screen. What each step looks
 * like is in `bodies/`; what it asks, when it applies, when it is answered and
 * what it saves are all here, next to each other.
 *
 * Welcome → Purpose → Basics → Location → Education & work → Lifestyle →
 * About you → Photos → Verification → [category] → Preferences → Finish.
 *
 * Every step saves when the member presses continue (see `save`), and the
 * step's key is stored as progress, so closing the app loses nothing.
 */

/** Facts a step's `isAnswered` needs that are not in the draft. */
export type StepFacts = {
  /** Photos that count towards the minimum: uploaded and not rejected. */
  photoCount: number;
};

export type StepContext = {
  draft: OnboardingDraft;
  patch: (update: Partial<OnboardingDraft>) => void;
  /** Jumps to a step by key. Used by the preview's "Edit" links. */
  goTo: (key: string) => void;
};

export type StepConfig = {
  /** Stable id. Stored as progress, so never rename one that has shipped. */
  key: string;
  /** The part of the flow, shown above the question. */
  section: string;
  icon: keyof typeof Ionicons.glyphMap;
  question: string | ((draft: OnboardingDraft) => string);
  subtitle?: string | ((draft: OnboardingDraft) => string);
  privacy?: { text: string; visibility: 'shown' | 'hidden' };
  /** When present and false, the step is left out of the flow entirely. */
  applies?: (draft: OnboardingDraft) => boolean;
  /** The next button stays grey until this is true. */
  isAnswered: (draft: OnboardingDraft, facts: StepFacts) => boolean;
  /** Offers a "Skip" link. Only ever on steps whose answers are all optional. */
  skippable?: boolean;
  /** What pressing continue writes. Absent for steps that store nothing. */
  save?: (draft: OnboardingDraft) => Omit<OnboardingStepSave, 'step'>;
  Body: (props: StepContext) => React.JSX.Element;
};

const allNumbersValid = (...values: string[]): boolean => values.every(isWholeNumberOrBlank);

export const ONBOARDING_STEPS: StepConfig[] = [
  {
    key: 'welcome',
    section: 'Welcome',
    icon: 'sparkles-outline',
    question: 'Let’s build your profile',
    subtitle: 'A real profile gets better introductions. Here is how this works.',
    isAnswered: () => true,
    Body: WelcomeBody,
  },
  {
    key: 'purpose',
    section: 'Purpose',
    icon: 'compass-outline',
    question: 'What are you here for?',
    subtitle: 'It decides who you are shown, and who is shown you.',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    isAnswered: (draft) => draft.purpose !== null,
    save: (draft) => ({
      profile: { intents: [draft.purpose as SelectableIntent] },
      preferences: {
        intents: [draft.purpose as SelectableIntent],
        ...(isRomanticIntent(draft.purpose) ? {} : { interestedIn: [] }),
      },
    }),
    Body: PurposeBody,
  },
  {
    key: 'name',
    section: 'Basics',
    icon: 'person-outline',
    question: 'What should people call you?',
    subtitle: 'Your first name is what appears on your card.',
    privacy: { text: 'First name shown to everyone you’re matched with.', visibility: 'shown' },
    isAnswered: (draft) =>
      draft.firstName.trim().length >= ONBOARDING_LIMITS.name.min &&
      draft.lastName.trim().length <= ONBOARDING_LIMITS.lastName.max,
    save: (draft) => ({
      profile: { name: draft.firstName.trim() },
      details: { lastName: textOrNull(draft.lastName), hiddenFields: hiddenFieldsOf(draft) },
    }),
    Body: NameBody,
  },
  {
    key: 'birthday',
    section: 'Basics',
    icon: 'gift-outline',
    question: 'When’s your birthday?',
    subtitle: 'So nobody has to ask, and so we can keep this an adults-only app.',
    privacy: { text: 'Never shown. Only your age appears.', visibility: 'hidden' },
    isAnswered: (draft) => draft.dateOfBirth !== null,
    save: (draft) => ({ profile: { dateOfBirth: draft.dateOfBirth as string } }),
    Body: BirthdayBody,
  },
  {
    key: 'gender',
    section: 'Basics',
    icon: 'people-outline',
    question: 'How do you describe yourself?',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    isAnswered: (draft) => draft.gender !== null,
    save: (draft) => ({
      profile: { gender: draft.gender as NonNullable<OnboardingDraft['gender']> },
      details: { pronouns: textOrNull(draft.pronouns) },
    }),
    Body: GenderBody,
  },
  {
    key: 'interestedIn',
    section: 'Basics',
    icon: 'heart-outline',
    question: 'Who would you like to meet?',
    // Only asked where it means something. A co-founder search that filtered by
    // gender would be doing something nobody asked it to do.
    applies: (draft) => isRomanticIntent(draft.purpose),
    privacy: { text: 'Never shown to anybody. It only filters who you see.', visibility: 'hidden' },
    isAnswered: (draft) => draft.interestedIn.length > 0,
    save: (draft) => ({ preferences: { interestedIn: draft.interestedIn } }),
    Body: InterestedInBody,
  },
  {
    key: 'location',
    section: 'Location',
    icon: 'location-outline',
    question: 'Where are you based?',
    subtitle: 'Meets happen at a café, so your city actually matters.',
    privacy: { text: 'Your city is shown. Never your exact location.', visibility: 'shown' },
    isAnswered: (draft) => draft.city.trim().length > 1,
    save: (draft) => ({
      profile: { city: draft.city.trim() },
      preferences: { cities: [draft.city.trim()] },
      details: { hometown: textOrNull(draft.hometown), hiddenFields: hiddenFieldsOf(draft) },
    }),
    Body: LocationBody,
  },
  {
    key: 'languages',
    section: 'Location',
    icon: 'language-outline',
    question: 'Which languages do you speak?',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    isAnswered: () => true,
    skippable: true,
    save: (draft) => ({ details: { languages: draft.languages } }),
    Body: LanguagesBody,
  },
  {
    key: 'status',
    section: 'Education & work',
    icon: 'briefcase-outline',
    question: 'What are you up to these days?',
    subtitle: 'The next questions follow from this one.',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    isAnswered: (draft) => draft.occupationStatus !== null,
    save: (draft) => ({
      details: {
        occupationStatus: draft.occupationStatus as NonNullable<
          OnboardingDraft['occupationStatus']
        >,
      },
    }),
    Body: StatusBody,
  },
  {
    key: 'education',
    section: 'Education & work',
    icon: 'school-outline',
    question: (draft) =>
      isStudying(draft.occupationStatus ?? undefined) ? 'What are you studying?' : 'Your education',
    subtitle: 'All optional. Add as much or as little as you like.',
    privacy: { text: 'Shown on your profile. Your college can be hidden.', visibility: 'shown' },
    isAnswered: (draft) => allNumbersValid(draft.graduationYear),
    skippable: true,
    save: (draft) => {
      const declined = draft.educationLevel === 'prefer_not_to_say';
      return {
        details: {
          educationLevel: draft.educationLevel,
          // "Prefer not to say" hides the other fields, so it clears them too
          // rather than keeping answers the member can no longer see.
          institution: declined ? null : textOrNull(draft.institution),
          degree: declined ? null : textOrNull(draft.degree),
          fieldOfStudy: declined ? null : textOrNull(draft.fieldOfStudy),
          graduationYear: declined ? null : wholeNumberOrNull(draft.graduationYear),
          hiddenFields: hiddenFieldsOf(draft),
        },
      };
    },
    Body: EducationBody,
  },
  {
    key: 'studies',
    section: 'Education & work',
    icon: 'library-outline',
    question: 'A bit more about your studies',
    subtitle: 'All optional.',
    applies: (draft) => isStudying(draft.occupationStatus ?? undefined),
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    isAnswered: (draft) => allNumbersValid(draft.studyYear),
    skippable: true,
    save: (draft) => ({
      details: {
        studyYear: wholeNumberOrNull(draft.studyYear),
        studyMode: draft.studyMode,
        previousEducation: textOrNull(draft.previousEducation),
        internship: textOrNull(draft.internship),
        careerInterests: draft.careerInterests,
        skills: draft.skills,
      },
    }),
    Body: StudiesBody,
  },
  {
    key: 'work',
    section: 'Education & work',
    icon: 'business-outline',
    question: 'What do you do?',
    subtitle: 'All optional. Your company and work location can be hidden.',
    applies: (draft) => isWorking(draft.occupationStatus ?? undefined),
    privacy: { text: 'Shown on your profile, except what you hide.', visibility: 'shown' },
    isAnswered: (draft) => allNumbersValid(draft.yearsExperience),
    skippable: true,
    save: (draft) => ({
      details: {
        occupation: textOrNull(draft.occupation),
        jobTitle: textOrNull(draft.jobTitle),
        company: textOrNull(draft.company),
        industry: textOrNull(draft.industry),
        yearsExperience: wholeNumberOrNull(draft.yearsExperience),
        workLocation: textOrNull(draft.workLocation),
        workMode: draft.workMode,
        hiddenFields: hiddenFieldsOf(draft),
      },
    }),
    Body: WorkBody,
  },
  {
    key: 'lifestyle',
    section: 'Lifestyle',
    icon: 'leaf-outline',
    question: 'A few lifestyle questions',
    subtitle: 'Tap to answer, tap again to clear. Skip any you like.',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    isAnswered: () => true,
    skippable: true,
    save: (draft) => ({
      details: {
        smoking: draft.smoking,
        drinking: draft.drinking,
        diet: draft.diet,
        exercise: draft.exercise,
        sleep: draft.sleep,
        pets: draft.pets,
      },
    }),
    Body: LifestyleBody,
  },
  {
    key: 'interests',
    section: 'About you',
    icon: 'pricetags-outline',
    question: 'What are you into?',
    subtitle: 'Hobbies and interests. This is what the first ten minutes of coffee gets spent on.',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    isAnswered: (draft) =>
      draft.interests.length >= ONBOARDING_LIMITS.interests.min &&
      draft.interests.length <= ONBOARDING_LIMITS.interests.max,
    save: (draft) => ({ profile: { interests: draft.interests } }),
    Body: InterestsBody,
  },
  {
    key: 'intro',
    section: 'About you',
    icon: 'chatbubble-ellipses-outline',
    question: 'Introduce yourself',
    subtitle: 'A few sentences in your own words.',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    isAnswered: (draft) => draft.bio.trim().length >= ONBOARDING_LIMITS.intro.min,
    save: (draft) => ({ profile: { bio: draft.bio.trim(), headline: draft.headline.trim() } }),
    Body: IntroBody,
  },
  {
    key: 'prompts',
    section: 'About you',
    icon: 'help-buoy-outline',
    question: 'Pick a prompt or two',
    subtitle: 'Easier than a bio, and a better way into a first conversation.',
    privacy: { text: 'Shown on your profile.', visibility: 'shown' },
    // A chosen prompt has to be answered or removed; none at all is fine.
    isAnswered: (draft) => draft.prompts.every((prompt) => prompt.answer.trim().length > 0),
    skippable: true,
    save: (draft) => ({
      details: { prompts: draft.prompts.filter((prompt) => prompt.answer.trim()) },
    }),
    Body: PromptsBody,
  },
  {
    key: 'photos',
    section: 'Photos',
    icon: 'camera-outline',
    question: 'Add your photos',
    subtitle: `At least ${MIN_PHOTOS}. The first is what people see — a real, recent face does better than a good one.`,
    privacy: { text: 'Shown on your profile once a moderator has seen it.', visibility: 'shown' },
    isAnswered: (_draft, facts) => facts.photoCount >= MIN_PHOTOS,
    Body: PhotosBody,
  },
  {
    key: 'verification',
    section: 'Verification',
    icon: 'shield-checkmark-outline',
    question: 'Keeping Offtexts real',
    subtitle: 'Nothing to do here yet.',
    isAnswered: () => true,
    Body: VerificationBody,
  },
  // The category questions (dating, life partner, co-founder) go here — see
  // CATEGORY_STEPS below.
  {
    key: 'preferences',
    section: 'Preferences',
    icon: 'options-outline',
    question: 'Who should we show you?',
    privacy: { text: 'Never shown to anybody.', visibility: 'hidden' },
    isAnswered: (draft) => draft.ageMin <= draft.ageMax,
    save: (draft) => ({ preferences: { ageMin: draft.ageMin, ageMax: draft.ageMax } }),
    Body: PreferencesBody,
  },
  {
    key: 'guidelines',
    section: 'Finish',
    icon: 'hand-left-outline',
    question: 'How this works',
    subtitle: 'Four things everybody here has agreed to.',
    isAnswered: (draft) => draft.agreedToGuidelines,
    Body: GuidelinesBody,
  },
  {
    key: 'notifications',
    section: 'Finish',
    icon: 'notifications-outline',
    question: 'Want to know when something happens?',
    subtitle: 'There is no chat here, so this is the only way we would reach you.',
    privacy: { text: 'You can change this at any time.', visibility: 'hidden' },
    isAnswered: (draft) => draft.pushEnabled !== null,
    save: (draft) => ({ preferences: { pushEnabled: draft.pushEnabled ?? false } }),
    Body: NotificationsBody,
  },
  {
    key: 'preview',
    section: 'Finish',
    icon: 'eye-outline',
    question: 'Here’s your profile',
    subtitle: 'Check it over. Tap Edit on anything to change it.',
    isAnswered: () => true,
    Body: PreviewBody,
  },
];

/**
 * The purpose-specific questions, inserted after verification.
 *
 * Only the member's current purpose's steps are shown — `visibleSteps` picks
 * them. They save and resume exactly like every other step. What each purpose
 * requires is `missingCategoryAnswer` in the domain and
 * `complete_my_onboarding()` in migration 0014; each `isAnswered` below
 * matches it, so the next button is grey for exactly the answers the server
 * would refuse to finish without.
 */
export const CATEGORY_STEPS: Record<SelectableIntent, StepConfig[]> = {
  dating: [
    {
      key: 'datingGoal',
      section: 'Dating',
      icon: 'heart-circle-outline',
      question: 'What are you looking for?',
      subtitle: 'Being clear about this now saves everybody a wasted coffee.',
      privacy: { text: 'Shown on your profile.', visibility: 'shown' },
      isAnswered: (draft) => draft.relationshipGoal !== null,
      save: (draft) => ({ details: { relationshipGoal: draft.relationshipGoal } }),
      Body: DatingGoalBody,
    },
    {
      key: 'datingMore',
      section: 'Dating',
      icon: 'sparkles-outline',
      question: 'A little more',
      subtitle: 'Both optional. Tap again to clear an answer.',
      privacy: { text: 'Shown on your profile.', visibility: 'shown' },
      isAnswered: () => true,
      skippable: true,
      save: (draft) => ({
        details: { childrenPlan: draft.childrenPlan, partnerValues: draft.partnerValues },
      }),
      Body: DatingMoreBody,
    },
  ],
  life_partner: [
    {
      key: 'marriageBasics',
      section: 'Life partner',
      icon: 'ribbon-outline',
      question: 'Marriage basics',
      subtitle: 'The two things everybody looking for a life partner asks first. Both are needed.',
      privacy: { text: 'Shown on your profile.', visibility: 'shown' },
      isAnswered: (draft) => draft.marriageTimeline !== null && draft.maritalStatus !== null,
      save: (draft) => ({
        details: { marriageTimeline: draft.marriageTimeline, maritalStatus: draft.maritalStatus },
      }),
      Body: MarriageBasicsBody,
    },
    {
      key: 'familyFaith',
      section: 'Life partner',
      icon: 'home-outline',
      question: 'Family & faith',
      subtitle: 'All optional. Your religion stays private unless you choose to show it.',
      privacy: { text: 'Shown on your profile, except your religion.', visibility: 'shown' },
      isAnswered: () => true,
      skippable: true,
      save: (draft) => ({
        details: {
          childrenPlan: draft.childrenPlan,
          religion: draft.religion,
          faithImportance: draft.faithImportance,
          livingArrangement: draft.livingArrangement,
          familyInvolvement: draft.familyInvolvement,
          openToRelocate: draft.openToRelocate,
          hiddenFields: hiddenFieldsOf(draft),
        },
      }),
      Body: FamilyFaithBody,
    },
  ],
  co_founder: [
    {
      key: 'founderSide',
      section: 'Co-founder',
      icon: 'rocket-outline',
      question: 'Your side of the startup',
      subtitle: 'Your role and how much time you can give are needed. The rest is optional.',
      privacy: { text: 'Shown on your profile.', visibility: 'shown' },
      isAnswered: (draft) => draft.cofounderRole !== null && draft.founderCommitment !== null,
      save: (draft) => ({
        details: {
          cofounderRole: draft.cofounderRole,
          startupStage: draft.cofounderRole === 'have_startup' ? draft.startupStage : null,
          founderSkills: draft.founderSkills,
          founderCommitment: draft.founderCommitment,
        },
      }),
      Body: FounderSideBody,
    },
    {
      key: 'founderSeeking',
      section: 'Co-founder',
      icon: 'people-circle-outline',
      question: 'Who are you looking for?',
      subtitle: 'Pick at least one strength you need beside you.',
      privacy: { text: 'Shown on your profile.', visibility: 'shown' },
      isAnswered: (draft) => draft.seekingSkills.length > 0,
      save: (draft) => ({
        details: {
          seekingSkills: draft.seekingSkills,
          startupIndustries: draft.startupIndustries,
          fundingPlan: draft.fundingPlan,
        },
      }),
      Body: FounderSeekingBody,
    },
  ],
};

/** The steps that apply to this draft, in order. */
export function visibleSteps(draft: OnboardingDraft): StepConfig[] {
  const category = draft.purpose ? CATEGORY_STEPS[draft.purpose] : [];
  const at = ONBOARDING_STEPS.findIndex((step) => step.key === 'verification') + 1;
  const all = [...ONBOARDING_STEPS.slice(0, at), ...category, ...ONBOARDING_STEPS.slice(at)];
  return all.filter((step) => (step.applies ? step.applies(draft) : true));
}
