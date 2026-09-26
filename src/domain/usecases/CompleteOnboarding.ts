import {
  MIN_AGE,
  MIN_PHOTOS,
  missingCategoryAnswer,
  usablePhotos,
  type Person,
  type PreferencesUpdate,
  type ProfileDetails,
  type ProfileDetailsUpdate,
} from '@/domain/entities';
import {
  AppError,
  failure,
  type PhotoRepository,
  type PreferencesRepository,
  type ProfileDetailsRepository,
  type ProfileRepository,
  type ProfileUpdate,
  type Result,
  success,
} from '@/domain/repositories';

/**
 * Onboarding, as two use cases: save a step, and finish.
 *
 * WHY IT SAVES AS IT GOES
 * The first version saved once at the end, so an abandoned wizard left
 * nothing behind. The flow is now long enough that losing ten minutes of
 * answers to a phone call is the bigger harm, so every step is saved and the
 * member resumes where they stopped. A half-built profile is told apart from a
 * finished one by `onboardingCompletedAt`, which only `CompleteOnboarding`
 * can cause to be set.
 */

/**
 * Mirrors the CHECK constraints in migrations 0001, 0012 and 0014, so a member is
 * told before the round trip, in words, rather than after it by Postgres.
 */
export const LIMITS = {
  name: { min: 2, max: 60 },
  lastName: { max: 60 },
  pronouns: { max: 30 },
  place: { max: 80 },
  headline: { max: 140 },
  bio: { max: 1000 },
  /** The introduction onboarding asks for. Shorter than `bio` on purpose. */
  intro: { min: 10, max: 500 },
  interests: { min: 3, max: 10 },
  languages: { max: 10 },
  shortText: { max: 80 },
  longText: { max: 120 },
  previousEducation: { max: 200 },
  careerInterests: { max: 10 },
  skills: { max: 15 },
  studyYear: { min: 1, max: 10 },
  yearsExperience: { min: 0, max: 60 },
  graduationYear: { min: 1950, max: 2100 },
  prompts: { max: 3 },
  promptAnswer: { max: 200 },
  partnerValues: { max: 3 },
  founderSkills: { max: 3 },
  seekingSkills: { max: 3 },
  startupIndustries: { max: 5 },
} as const;

/** One step's worth of answers, split by where each lands. */
export type OnboardingStepSave = {
  /** The step's key. Saved as progress, so the flow resumes after it. */
  step: string;
  profile?: ProfileUpdate;
  details?: ProfileDetailsUpdate;
  preferences?: PreferencesUpdate;
};

/**
 * Saves one step.
 *
 * A use case rather than three repository calls in a screen, because the
 * rules span all three and because the order matters: progress is written
 * last, so a step whose answers failed to save is not marked as done.
 *
 * NOT ATOMIC. If the profile saves and the details do not, the member sees the
 * error and presses continue again — every write here is idempotent, so a
 * retry converges instead of duplicating anything.
 */
export class SaveOnboardingStep {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly details: ProfileDetailsRepository,
    private readonly preferences: PreferencesRepository,
  ) {}

  async execute(save: OnboardingStepSave, today: Date = new Date()): Promise<Result<void>> {
    const invalid =
      validateProfile(save.profile, today) ??
      validateDetails(save.details, today) ??
      validatePreferences(save.preferences);
    if (invalid) return failure(invalid);

    if (save.profile && Object.keys(save.profile).length > 0) {
      const profile = await this.profiles.updateMyProfile(save.profile);
      if (!profile.ok) return profile;
    }

    if (save.preferences && Object.keys(save.preferences).length > 0) {
      const preferences = await this.preferences.updateMyPreferences(save.preferences);
      if (!preferences.ok) return preferences;
    }

    const details = await this.details.updateMyDetails({
      ...save.details,
      onboardingStep: save.step,
    });
    if (!details.ok) return details;

    return success(undefined);
  }
}

/**
 * Finishes onboarding.
 *
 * Checks what the server will check, so the member is sent to the step that
 * is missing something instead of reading a database error. The server checks
 * it again regardless — see `complete_my_onboarding()` in migrations 0014 and
 * 0015 — and its answer is the one that counts.
 *
 * It reads what is SAVED rather than taking the wizard's working copy. The
 * two differ whenever the member has typed something and gone back without
 * pressing continue; checking the working copy would pass a profile the
 * server then refuses, or — worse — finish one whose saved answers are not
 * the ones the member was looking at.
 */
export class CompleteOnboarding {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly details: ProfileDetailsRepository,
    private readonly photos: PhotoRepository,
  ) {}

  async execute(): Promise<Result<Person>> {
    const [person, details, photos] = await Promise.all([
      this.profiles.getMyProfile(),
      this.details.getMyDetails(),
      this.photos.listMyPhotos(),
    ]);
    if (!person.ok) return person;
    if (!details.ok) return details;
    if (!photos.ok) return photos;

    const gap = onboardingGap(person.value, details.value, usablePhotos(photos.value).length);
    if (gap) return failure(new AppError('validation', gap.message, { field: gap.field }));

    return this.profiles.completeMyOnboarding();
  }
}

/**
 * The first thing a finished profile still lacks, or null.
 *
 * In the order `complete_my_onboarding()` checks, so the phone and the server
 * name the same missing thing. One check is the phone's alone: at least three
 * interests. The interests step has always required them, but the server has
 * never insisted, and adding that is a change to what "finished" means rather
 * than a fix — so it stays a courtesy here until it is decided.
 */
export function onboardingGap(
  person: Person,
  details: ProfileDetails,
  photoCount: number,
): { message: string; field: string } | null {
  if (person.intents.length === 0) {
    return { message: 'Choose what you’re here for.', field: 'purpose' };
  }
  if (!person.dateOfBirth) return { message: 'Add your date of birth.', field: 'dateOfBirth' };
  if (!person.gender) return { message: 'Add how you describe yourself.', field: 'gender' };
  if (!details.occupationStatus) {
    return { message: 'Tell us whether you’re working or studying.', field: 'occupationStatus' };
  }
  if (person.interests.length < LIMITS.interests.min) {
    return { message: `Pick at least ${LIMITS.interests.min} interests.`, field: 'interests' };
  }
  if (!person.bio?.trim()) return { message: 'Add a short introduction.', field: 'bio' };

  // The purpose's own required answers, in the same place in the order as the
  // server checks them.
  const category = missingCategoryAnswer(person.intents, details);
  if (category) return { message: category.message, field: category.field };

  if (photoCount < MIN_PHOTOS) {
    return { message: `Add at least ${MIN_PHOTOS} photos.`, field: 'photos' };
  }

  return null;
}

/* ---------------------------------------------------------- validation -- */

/** Whole years between two dates. */
export function ageOn(birthday: Date, on: Date): number {
  let age = on.getFullYear() - birthday.getFullYear();
  const monthDelta = on.getMonth() - birthday.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && on.getDate() < birthday.getDate())) age -= 1;
  return age;
}

const invalid = (message: string, field: string): AppError =>
  new AppError('validation', message, { field });

const tooLong = (value: string | null | undefined, max: number): boolean =>
  typeof value === 'string' && value.trim().length > max;

function validateProfile(update: ProfileUpdate | undefined, today: Date): AppError | null {
  if (!update) return null;

  if (update.name !== undefined) {
    const name = update.name.trim();
    if (name.length < LIMITS.name.min || name.length > LIMITS.name.max) {
      return invalid(
        `Your name needs to be between ${LIMITS.name.min} and ${LIMITS.name.max} characters.`,
        'name',
      );
    }
  }

  if (update.dateOfBirth !== undefined) {
    const birthday = new Date(update.dateOfBirth);
    if (Number.isNaN(birthday.getTime())) {
      return invalid('That date does not look right.', 'dateOfBirth');
    }
    // The database enforces this too. It is repeated here because this is
    // the layer that knows it is a product rule, and the message a member
    // reads should come from here, not from a Postgres error string.
    if (ageOn(birthday, today) < MIN_AGE) {
      return invalid(`You need to be ${MIN_AGE} or older to use Offtexts.`, 'dateOfBirth');
    }
  }

  if (update.city !== undefined && update.city.trim().length < 2) {
    return invalid('Add the city you live in.', 'city');
  }

  if (update.interests !== undefined) {
    if (update.interests.length < LIMITS.interests.min) {
      return invalid(
        `Pick at least ${LIMITS.interests.min} things you’re into — it is what the first conversation starts from.`,
        'interests',
      );
    }
    if (update.interests.length > LIMITS.interests.max) {
      return invalid(`Pick at most ${LIMITS.interests.max}.`, 'interests');
    }
  }

  if (update.bio !== undefined && update.bio.trim().length > LIMITS.bio.max) {
    return invalid(`Keep it under ${LIMITS.bio.max} characters.`, 'bio');
  }

  return null;
}

function validateDetails(update: ProfileDetailsUpdate | undefined, today: Date): AppError | null {
  if (!update) return null;

  const texts: [keyof ProfileDetailsUpdate, number, string][] = [
    ['lastName', LIMITS.lastName.max, 'Your last name'],
    ['pronouns', LIMITS.pronouns.max, 'Pronouns'],
    ['hometown', LIMITS.place.max, 'Hometown'],
    ['institution', LIMITS.longText.max, 'The college or university name'],
    ['degree', LIMITS.longText.max, 'The degree'],
    ['fieldOfStudy', LIMITS.longText.max, 'The field of study'],
    ['previousEducation', LIMITS.previousEducation.max, 'Previous education'],
    ['internship', LIMITS.longText.max, 'The internship'],
    ['occupation', LIMITS.shortText.max, 'Occupation'],
    ['jobTitle', LIMITS.shortText.max, 'Job title'],
    ['company', LIMITS.longText.max, 'Company'],
    ['industry', LIMITS.shortText.max, 'Industry'],
    ['workLocation', LIMITS.place.max, 'Work location'],
  ];
  for (const [field, max, label] of texts) {
    const value = update[field];
    if (typeof value === 'string' && tooLong(value, max)) {
      return invalid(`${label} can be at most ${max} characters.`, field);
    }
  }

  if (update.languages && update.languages.length > LIMITS.languages.max) {
    return invalid(`Pick at most ${LIMITS.languages.max} languages.`, 'languages');
  }
  if (update.careerInterests && update.careerInterests.length > LIMITS.careerInterests.max) {
    return invalid(`Add at most ${LIMITS.careerInterests.max}.`, 'careerInterests');
  }
  if (update.skills && update.skills.length > LIMITS.skills.max) {
    return invalid(`Add at most ${LIMITS.skills.max} skills.`, 'skills');
  }

  const caps: [keyof ProfileDetailsUpdate, number, string][] = [
    ['partnerValues', LIMITS.partnerValues.max, `Pick at most ${LIMITS.partnerValues.max}.`],
    ['founderSkills', LIMITS.founderSkills.max, `Pick at most ${LIMITS.founderSkills.max}.`],
    ['seekingSkills', LIMITS.seekingSkills.max, `Pick at most ${LIMITS.seekingSkills.max}.`],
    [
      'startupIndustries',
      LIMITS.startupIndustries.max,
      `Add at most ${LIMITS.startupIndustries.max} industries.`,
    ],
  ];
  for (const [field, max, message] of caps) {
    const value = update[field];
    if (Array.isArray(value) && value.length > max) return invalid(message, field);
  }

  if (typeof update.graduationYear === 'number') {
    const latest = today.getFullYear() + 10;
    if (update.graduationYear < LIMITS.graduationYear.min || update.graduationYear > latest) {
      return invalid(
        `Enter a year between ${LIMITS.graduationYear.min} and ${latest}.`,
        'graduationYear',
      );
    }
  }
  if (typeof update.studyYear === 'number') {
    if (update.studyYear < LIMITS.studyYear.min || update.studyYear > LIMITS.studyYear.max) {
      return invalid(
        `Enter a year between ${LIMITS.studyYear.min} and ${LIMITS.studyYear.max}.`,
        'studyYear',
      );
    }
  }
  if (typeof update.yearsExperience === 'number') {
    if (
      update.yearsExperience < LIMITS.yearsExperience.min ||
      update.yearsExperience > LIMITS.yearsExperience.max
    ) {
      return invalid(
        `Enter a number between ${LIMITS.yearsExperience.min} and ${LIMITS.yearsExperience.max}.`,
        'yearsExperience',
      );
    }
  }

  if (update.prompts) {
    if (update.prompts.length > LIMITS.prompts.max) {
      return invalid(`Choose at most ${LIMITS.prompts.max} prompts.`, 'prompts');
    }
    const keys = new Set(update.prompts.map((prompt) => prompt.key));
    if (keys.size !== update.prompts.length) {
      return invalid('Each prompt can only be answered once.', 'prompts');
    }
    for (const prompt of update.prompts) {
      const answer = prompt.answer.trim();
      if (!answer) return invalid('Answer the prompt, or remove it.', 'prompts');
      if (answer.length > LIMITS.promptAnswer.max) {
        return invalid(`Keep each answer under ${LIMITS.promptAnswer.max} characters.`, 'prompts');
      }
    }
  }

  return null;
}

function validatePreferences(update: PreferencesUpdate | undefined): AppError | null {
  if (!update) return null;

  const { ageMin, ageMax } = update;
  if (ageMin !== undefined && ageMin < MIN_AGE) {
    return invalid(`The youngest you can choose is ${MIN_AGE}.`, 'ageRange');
  }
  if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) {
    return invalid('The youngest age needs to be below the oldest.', 'ageRange');
  }

  return null;
}
