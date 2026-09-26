import type { Gender, MeetIntent, Person } from '@/domain/entities';
import { MIN_AGE } from '@/domain/entities';
import {
  AppError,
  failure,
  type PreferencesRepository,
  type ProfileRepository,
  type Result,
  success,
} from '@/domain/repositories';

/**
 * Everything the onboarding wizard collects.
 *
 * One object rather than a step-by-step save. The alternative — writing each
 * answer as it is given — leaves half-built profiles behind whenever somebody
 * abandons the flow, and there is then no way to tell those apart from real
 * members who simply have not filled much in.
 *
 * Optional fields are optional because the step is skippable or conditional,
 * not because the wizard might forget them.
 */
export type OnboardingAnswers = {
  /** What brings them here. Exactly one; `intents` on the profile is an array because that may change later. */
  purpose: MeetIntent;
  name: string;
  /** ISO date. */
  dateOfBirth: string;
  gender: Gender;
  city: string;
  /** Only asked when the purpose is one where it makes sense. */
  interestedIn?: Gender[];
  interests: string[];
  headline: string;
  bio?: string;
  /**
   * Photos are NOT here, and that absence is deliberate.
   *
   * A photo is a file in a bucket and a row with a moderation state, written by
   * `PhotoRepository` at the moment it is picked — this use case has no way to
   * store a URL and nowhere to put one. An earlier version accepted
   * `photoUrls`, ignored them, and reported success: the member uploaded a
   * photo, was told onboarding worked, and the photo was gone.
   */
  pushEnabled: boolean;
};

/** Mirrors the CHECK constraints in migration 0001, so a member is told before the round trip. */
export const LIMITS = {
  name: { min: 2, max: 60 },
  headline: { max: 140 },
  bio: { max: 1000 },
  interests: { min: 3, max: 10 },
} as const;

/**
 * Turns the wizard's answers into a profile and a set of preferences.
 *
 * A use case rather than two repository calls in a screen, because it enforces
 * something neither repository can see on its own: the two writes belong
 * together, and the validation spans both.
 *
 * NOT ATOMIC, and worth being honest about. The profile is written first and
 * the preferences second; if the second fails, the member has a profile and
 * default preferences rather than nothing. That is the better failure — they
 * can use the app and fix preferences later — but it is a real trade and the
 * right fix eventually is a single RPC that does both in one transaction.
 */
export class CompleteOnboarding {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly preferences: PreferencesRepository,
  ) {}

  async execute(answers: OnboardingAnswers): Promise<Result<Person>> {
    const name = answers.name.trim();
    if (name.length < LIMITS.name.min || name.length > LIMITS.name.max) {
      return failure(
        new AppError(
          'validation',
          `Your name needs to be between ${LIMITS.name.min} and ${LIMITS.name.max} characters.`,
          { field: 'name' },
        ),
      );
    }

    const birthday = new Date(answers.dateOfBirth);
    if (Number.isNaN(birthday.getTime())) {
      return failure(
        new AppError('validation', 'That date does not look right.', { field: 'dateOfBirth' }),
      );
    }

    // The database enforces this too, and so does the sign-up screen. It is
    // repeated here because this is the layer that knows it is a product rule
    // and not an arbitrary constraint — and because the message a member reads
    // should come from here, not from a Postgres error string.
    if (ageOn(birthday, new Date()) < MIN_AGE) {
      return failure(
        new AppError('validation', `You need to be ${MIN_AGE} or older to use Offtexts.`, {
          field: 'dateOfBirth',
        }),
      );
    }

    if (answers.interests.length < LIMITS.interests.min) {
      return failure(
        new AppError(
          'validation',
          `Pick at least ${LIMITS.interests.min} things you're into — it is what the first conversation starts from.`,
          { field: 'interests' },
        ),
      );
    }

    if (answers.interests.length > LIMITS.interests.max) {
      return failure(
        new AppError('validation', `Pick at most ${LIMITS.interests.max}.`, { field: 'interests' }),
      );
    }

    const profile = await this.profiles.updateMyProfile({
      name,
      dateOfBirth: answers.dateOfBirth,
      gender: answers.gender,
      city: answers.city,
      headline: answers.headline.trim(),
      ...(answers.bio?.trim() ? { bio: answers.bio.trim() } : {}),
      interests: answers.interests,
      // An array with one value. The profile can hold several — somebody may
      // later be open to both networking and dating — but the wizard asks for
      // one, because asking a new member to pick several is asking them to
      // decide something they have not thought about yet.
      intents: [answers.purpose],
    });

    if (!profile.ok) return profile;

    const prefs = await this.preferences.updateMyPreferences({
      ...(answers.interestedIn ? { interestedIn: answers.interestedIn } : {}),
      intents: [answers.purpose],
      cities: [answers.city],
      pushEnabled: answers.pushEnabled,
    });

    // Deliberately not returned as a failure. See the class comment: the
    // profile exists, the member can use the app, and preferences have sane
    // defaults. Failing here would tell them onboarding did not work when most
    // of it did.
    if (!prefs.ok) {
      return success(profile.value);
    }

    return success(profile.value);
  }
}

/** Whole years between two dates. */
export function ageOn(birthday: Date, on: Date): number {
  let age = on.getFullYear() - birthday.getFullYear();
  const monthDelta = on.getMonth() - birthday.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && on.getDate() < birthday.getDate())) age -= 1;
  return age;
}
