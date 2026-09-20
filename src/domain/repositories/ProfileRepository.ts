import type { MeetIntent, Person, PersonId } from '@/domain/entities';
import type { Result } from './Result';

/** The fields a member may change about themselves. */
export type ProfileUpdate = {
  name?: string;
  age?: number;
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

  /**
   * Uploads a photo and returns its URL.
   * @param localUri A file:// URI from the image picker.
   */
  uploadPhoto(localUri: string): Promise<Result<string>>;
}
