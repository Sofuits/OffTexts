import {
  MEET_INTENTS,
  type MeetIntent,
  type Person,
  type VerificationStatus,
} from '@/domain/entities';
import type { ProfileRow, ProfileUpdate } from '@/infrastructure/supabase/rows';

/**
 * Converts a `profiles` row into a `Person`.
 *
 * This function is the reason the app survives a backend change. Everything
 * database-shaped — snake_case, nullable columns, loose text where the domain
 * wants a union — stops here. Above this line there are only entities.
 *
 * It is deliberately forgiving. A row with a `verification` value we have never
 * seen (added by a migration, written by an admin tool) becomes 'unverified'
 * rather than throwing, because one unexpected string should degrade one card,
 * not blank an entire list.
 */

const isMeetIntent = (value: string): value is MeetIntent =>
  (MEET_INTENTS as readonly string[]).includes(value);

const VERIFICATIONS: VerificationStatus[] = ['unverified', 'pending', 'verified', 'rejected'];

const toVerification = (value: string): VerificationStatus =>
  (VERIFICATIONS as string[]).includes(value) ? (value as VerificationStatus) : 'unverified';

export function toPerson(row: ProfileRow): Person {
  return {
    // Also the auth user id — profiles are keyed by it. See ProfileRow.
    id: row.id,
    name: row.name,
    // The column is nullable; the entity says "absent", not "null".
    ...(row.age === null ? {} : { age: row.age }),
    headline: row.headline,
    ...(row.bio === null ? {} : { bio: row.bio }),
    city: row.city,
    photoUrls: row.photo_urls ?? [],
    interests: row.interests ?? [],
    intents: (row.intents ?? []).filter(isMeetIntent),
    verification: toVerification(row.verification),
  };
}

/** The other direction, for writes. Only the columns a member may change. */
type ProfileUpdateRow = ProfileUpdate;

export function toProfileUpdateRow(update: {
  name?: string;
  age?: number;
  headline?: string;
  bio?: string;
  city?: string;
  interests?: string[];
  intents?: MeetIntent[];
}): ProfileUpdateRow {
  const row: ProfileUpdateRow = {};
  if (update.name !== undefined) row.name = update.name;
  if (update.age !== undefined) row.age = update.age;
  if (update.headline !== undefined) row.headline = update.headline;
  if (update.bio !== undefined) row.bio = update.bio;
  if (update.city !== undefined) row.city = update.city;
  if (update.interests !== undefined) row.interests = update.interests;
  if (update.intents !== undefined) row.intents = update.intents;
  return row;
}
