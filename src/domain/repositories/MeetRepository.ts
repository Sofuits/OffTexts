import type { Meet, MeetId, MatchId, VenueId } from '@/domain/entities';
import type { Result } from './Result';

/**
 * Everything needed to book a table.
 *
 * WHY A MATCH AND NOT A PERSON
 * An earlier version of this took a `personId` and a list of times the
 * requester was free, and left a service to pick one. That shape cannot be
 * implemented against the database as it now stands: `api_v1.request_meeting`
 * takes a match, because being matched is what grants the right to book at all
 * — the function looks the match up under the caller's own RLS and refuses if
 * they are not in it. A `personId` would have had to be turned back into a
 * match somewhere, and the only place that could happen safely is the server.
 *
 * The times collapsed for the same reason. There is no scheduling service, and
 * a list of "times I am free" with nothing to reconcile it against is a to-do
 * item pretending to be a feature. One chosen instant is a booking.
 */
export type MeetingRequest = {
  matchId: MatchId;
  venueId: VenueId;
  /** An absolute instant. The café's local time is a display concern. */
  scheduledFor: Date;
  /** Defaults to an hour, which is what a coffee is. */
  durationMinutes?: number;
};

/**
 * Booked meets.
 *
 * `listMeets` returns everything rather than offering `listUpcoming` and
 * `listHistory`. Splitting the two belongs in the domain (`isUpcoming`), not in
 * the query: one fetch, one cache entry, and a rule that cannot disagree with
 * itself between two endpoints.
 */
export interface MeetRepository {
  listMeets(): Promise<Result<Meet[]>>;

  getMeetById(id: MeetId): Promise<Result<Meet>>;

  /**
   * Books a table.
   *
   * Returns the id rather than the meeting. The server writes several columns
   * the caller cannot predict — the fee as quoted at this instant, the venue's
   * name and area copied down by trigger — so the honest thing is to hand back
   * a handle and let the detail screen read the row that actually exists.
   */
  requestMeeting(request: MeetingRequest): Promise<Result<MeetId>>;

  cancelMeet(id: MeetId, reason?: string): Promise<Result<Meet>>;
}
