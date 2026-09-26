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
  dating: 'Meet someone and see where it goes.',
  life_partner: 'Looking for a serious relationship that could lead to marriage.',
  networking: 'Meet people in your field without a conference badge.',
  co_founder: 'Find someone to build something with.',
};

/**
 * The purposes a member can choose.
 *
 * `networking` is no longer offered. It stays in `MEET_INTENTS` because it is
 * still a value in the database enum and on some existing profiles — dropping
 * it there would fail to read those rows — but nothing new is created with it.
 * A screen that lets somebody pick a purpose lists these, not `MEET_INTENTS`.
 */
export const SELECTABLE_INTENTS = ['dating', 'life_partner', 'co_founder'] as const;
export type SelectableIntent = (typeof SELECTABLE_INTENTS)[number];

/** A short emoji per purpose, for the screen that asks. */
export const MEET_INTENT_EMOJI: Record<MeetIntent, string> = {
  dating: '❤️',
  life_partner: '💍',
  networking: '🤝',
  co_founder: '🚀',
};

/** Purposes where "who would you like to meet" is a sensible question to ask. */
export function isRomanticIntent(intent: MeetIntent | null | undefined): boolean {
  return intent === 'dating' || intent === 'life_partner';
}

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
  /** ISO timestamp. Absent until onboarding has been finished and checked. */
  onboardingCompletedAt?: string;
};

/** True when this member has passed ID verification and may be shown to others. */
export function isDiscoverable(person: Person): boolean {
  return person.verification === 'verified';
}

/**
 * Whether this member has been through onboarding.
 *
 * The signup trigger creates a profile before the member has answered
 * anything, and onboarding now saves as it goes, so neither "a profile exists"
 * nor "it has a date of birth" means finished. The server stamps
 * `onboardingCompletedAt` only once it has checked the profile is complete —
 * see `complete_my_onboarding()` in migrations 0012 and 0014 — and members who finished
 * the earlier wizard were stamped when that migration ran.
 */
export function hasCompletedOnboarding(person: Person): boolean {
  return Boolean(person.onboardingCompletedAt);
}
