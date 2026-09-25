import type { MeetId, MeetStatus } from '@/domain/entities/Meet';
import type { Person, PersonId, VerificationStatus } from '@/domain/entities/Person';
import type { Review } from '@/domain/entities/Review';
import type { Result } from './Result';

/**
 * What the admin portal needs, as an interface.
 *
 * Kept apart from `ProfileRepository` and `MeetRepository` on purpose. Those
 * describe what a *member* can do — read their own profile, list their own
 * meets — and every method on them is scoped to the signed-in person. These
 * methods are scoped to nobody: they read across the whole table.
 *
 * Folding "list every member" into `ProfileRepository` would put a privileged
 * operation one autocomplete away from every screen in the phone app, and would
 * make the interface lie about what a member can do. Two audiences, two
 * interfaces.
 *
 * Nothing here is enforced by this file. `public.is_staff()` in migration 0003
 * is what actually decides, and it decides for every caller including curl.
 * These signatures only describe what a staff session is able to ask for.
 */

export type MemberFilter = {
  /** Matches name or city, case-insensitively. */
  search?: string;
  verification?: VerificationStatus;
  city?: string;
  limit?: number;
  /** Keyset cursor: the `createdAt` of the last row you were given. */
  cursor?: string;
};

export type Page<T> = {
  items: T[];
  /** Null when there is nothing after this page. */
  nextCursor: string | null;
};

/** A member as the admin list shows them: the profile plus when they joined. */
export type MemberRecord = {
  person: Person;
  joinedAt: Date;
};

/**
 * A booked meet, from the outside.
 *
 * Deliberately not the `Meet` entity. `Meet` is shaped around the person
 * reading it — `personId` and `personName` mean "the other one", with the
 * current user implied by who is asking. An admin is neither participant, so
 * that shape has no meaning here and reusing it would mean inventing a
 * "current user" to make the mapper work.
 *
 * Two audiences see the same row differently. That is a reason for two types,
 * not a reason to bend one.
 */
export type ReservationRecord = {
  id: MeetId;
  requesterId: PersonId;
  requesterName: string;
  recipientId: PersonId;
  recipientName: string;
  venueName: string;
  venueArea: string;
  scheduledFor: Date;
  status: MeetStatus;
};

/** A review, plus when the meet it describes actually happened. */
export type ReviewRecord = {
  review: Review;
  meetScheduledFor: Date;
};

export type AdminCounts = {
  members: number;
  verifiedMembers: number;
  reservations: number;
  reviews: number;
};

export interface AdminRepository {
  /**
   * Whether the signed-in user is staff.
   *
   * Asked of the database rather than decided in the app. A portal that
   * establishes its own authority is a portal that can be lied to by editing
   * localStorage; this returns what `public.staff` actually says.
   */
  amIStaff(): Promise<Result<boolean>>;

  listMembers(filter?: MemberFilter): Promise<Result<Page<MemberRecord>>>;

  /**
   * Moves a member into or out of the discovery feed.
   *
   * "Discoverable" is not a separate flag — `profiles: read own or verified`
   * already hides unverified members from everyone else, so verification IS
   * the feed. A second column would be a second source of truth for one
   * question, and the two would eventually disagree.
   */
  setVerification(id: PersonId, status: VerificationStatus): Promise<Result<Person>>;

  listReservations(limit?: number): Promise<Result<ReservationRecord[]>>;

  listReviews(limit?: number): Promise<Result<ReviewRecord[]>>;

  /** Headline numbers for the overview. */
  getCounts(): Promise<Result<AdminCounts>>;
}
