/**
 * A member of Offtexts, as the app understands one.
 *
 * Domain entities know nothing about how they are stored or transported. There
 * is no `created_at`, no `user_id`, no Supabase row shape here — mapping from
 * a wire format into this type is the data layer's job (`data/mappers`).
 *
 * If this file ever imports from `data/`, `infrastructure/` or `presentation/`,
 * the architecture has been violated. The domain is the innermost layer and
 * depends on nothing.
 */

import type { Gender } from './Matching';

export type PersonId = string;

/** What a member is looking for. The strings are the contract with the database. */
export const MEET_INTENTS = ['dating', 'life_partner', 'networking', 'co_founder'] as const;
export type MeetIntent = (typeof MEET_INTENTS)[number];

/** Display label for an intent. Kept in the domain because it is product language,
 *  not presentation styling — the web app and any future client use the same words. */
export const MEET_INTENT_LABELS: Record<MeetIntent, string> = {
  dating: 'Dating',
  life_partner: 'Life partner',
  networking: 'Networking',
  co_founder: 'Co-founder',
};

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

/**
 * A short line explaining each purpose, for the screen that asks.
 *
 * Product language, like the labels above, so the phone and the admin portal
 * describe the same thing the same way.
 */
export const MEET_INTENT_DESCRIPTIONS: Record<MeetIntent, string> = {
  dating: 'Meet someone you might click with, over coffee rather than over text.',
  life_partner: 'Looking for something lasting, and happy to say so.',
  networking: 'Meet people in your field without a conference badge.',
  co_founder: 'Find someone to build the thing with.',
};

export type Person = {
  id: PersonId;
  name: string;
  /**
   * Years. Optional because not every member shares it, and derived from
   * `dateOfBirth` by the database whenever that is known — a stored age is
   * wrong by one for a few weeks every year otherwise.
   */
  age?: number;
  /** ISO date. The fact; `age` is a cache of it. */
  dateOfBirth?: string;
  gender?: Gender;
  headline: string;
  bio?: string;
  city: string;
  /** Ordered. The first is the avatar. */
  photoUrls: string[];
  interests: string[];
  intents: MeetIntent[];
  verification: VerificationStatus;
};

/** True when this member has passed ID verification and may be shown to others. */
export function isDiscoverable(person: Person): boolean {
  return person.verification === 'verified';
}

/**
 * Whether this member has been through onboarding.
 *
 * The signup trigger creates a profile before the member has answered
 * anything — name `New member`, city `Pune`, everything else empty — so the
 * existence of a profile row says nothing at all. Something has to distinguish
 * "account exists" from "profile filled in", and this is it.
 *
 * The two fields chosen are the two the wizard is the only way to set and the
 * profile editor is the only way to change without being able to clear:
 * `dateOfBirth` has no default and is never blanked, and `intents` starts as an
 * empty array and the editor requires at least one.
 *
 * Headline, interests and photos are deliberately NOT part of this test. They
 * are all things a member might legitimately empty later, and a completeness
 * check that sends an existing member back through onboarding because they
 * deleted an interest is worse than one that lets a sparse profile through.
 */
export function hasCompletedOnboarding(person: Person): boolean {
  return Boolean(person.dateOfBirth) && person.intents.length > 0;
}
