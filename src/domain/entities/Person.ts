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

export type Person = {
  id: PersonId;
  name: string;
  /** Years. Optional because not every member shares it. */
  age?: number;
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
