import type { Gender, MeetIntent, Person, PersonId } from '@/domain/entities';
import type { Result } from './Result';

/** The fields a member may change about themselves. */
export type ProfileUpdate = {
  name?: string;
  age?: number;
  /**
   * ISO date. Preferred over `age`, which the database derives from it — an age
   * written once is wrong for a few weeks every year, and nothing goes back to
   * correct it.
   */
  dateOfBirth?: string;
  gender?: Gender;
  headline?: string;
  bio?: string;
  city?: string;
  interests?: string[];
  intents?: MeetIntent[];
};

/**
 * Profile access, as the application needs it.
 *
 * This is an interface and nothing more: no Supabase, no HTTP, no SQL. The
 * domain declares what it needs; `data/repositories` decides how. That
 * inversion is what lets the backend change without touching anything above
 * this line, and what lets a test hand a screen a fake in one line.
 */
export interface ProfileRepository {
  /** The signed-in member's own profile. */
  getMyProfile(): Promise<Result<Person>>;

  getProfileById(id: PersonId): Promise<Result<Person>>;

  updateMyProfile(update: ProfileUpdate): Promise<Result<Person>>;

  // Photos are NOT here. They are files, with their own moderation state and
  // their own order, and an `uploadPhoto` that returned a URL left the caller
  // holding something it could not store. See `PhotoRepository`.
}
