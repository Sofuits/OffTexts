import type { Gender, MeetIntent } from '@/domain/entities';
import type { OnboardingAnswers } from '@/domain/usecases';

/**
 * The wizard's working copy.
 *
 * Every field is present from the start and nullable where unanswered, rather
 * than being a `Partial<OnboardingAnswers>`. The difference matters at the
 * keyboard: with a fixed shape, "has this been answered" is a comparison, and
 * TypeScript can check that the step which asks for a gender is the step that
 * writes one. With a Partial, every step reads `draft.gender?` and the compiler
 * stops being able to tell a missing answer from a typo in a key.
 *
 * It is deliberately NOT `OnboardingAnswers`. That type is the finished thing
 * the use case accepts; this one is allowed to be half-finished, which is the
 * entire state the wizard lives in.
 */
export type OnboardingDraft = {
  purpose: MeetIntent | null;
  name: string;
  /** ISO date, or null while it is not a valid one. */
  dateOfBirth: string | null;
  gender: Gender | null;
  city: string;
  interestedIn: Gender[];
  interests: string[];
  headline: string;
  bio: string;
  // Photos are deliberately absent. The photo step writes them as it goes —
  // the file is in the bucket the moment it is picked, so the row has to exist
  // too — and they are read back with `useMyPhotos()` rather than carried here.
  agreedToGuidelines: boolean;
  /** Null until asked, so "not answered" and "said no" stay different. */
  pushEnabled: boolean | null;
};

export const EMPTY_DRAFT: OnboardingDraft = {
  purpose: null,
  name: '',
  dateOfBirth: null,
  gender: null,
  city: '',
  interestedIn: [],
  interests: [],
  headline: '',
  bio: '',
  agreedToGuidelines: false,
  pushEnabled: null,
};

/**
 * The draft, once it is complete, as the use case wants it.
 *
 * Returns null rather than throwing when something required is missing. The
 * wizard already refuses to reach the end without those fields, so a null here
 * means a bug in the step configuration — and the screen turns that into a
 * message rather than a crash on somebody's phone.
 */
export function toAnswers(draft: OnboardingDraft): OnboardingAnswers | null {
  if (!draft.purpose || !draft.dateOfBirth || !draft.gender) return null;
  if (!draft.name.trim() || !draft.city.trim() || !draft.headline.trim()) return null;

  return {
    purpose: draft.purpose,
    name: draft.name.trim(),
    dateOfBirth: draft.dateOfBirth,
    gender: draft.gender,
    city: draft.city.trim(),
    // Only sent when the step that asks it was actually shown. An empty array
    // means "no preference" to the database, which is a different statement
    // from "we never asked" — and sending it for a co-founder search would
    // quietly narrow their results.
    ...(draft.interestedIn.length > 0 ? { interestedIn: draft.interestedIn } : {}),
    interests: draft.interests,
    headline: draft.headline.trim(),
    ...(draft.bio.trim() ? { bio: draft.bio.trim() } : {}),
    pushEnabled: draft.pushEnabled ?? false,
  };
}
