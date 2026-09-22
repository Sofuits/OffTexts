import { MEET_STATUSES, type Meet, type MeetStatus } from '@/domain/entities';
import type { MeetRow } from '@/infrastructure/supabase/rows';

/**
 * Converts a `meets` row into a `Meet`.
 *
 * A row has `requester_id` and `recipient_id`; the entity has one `personId`,
 * meaning "the other one". Which is which depends on who is asking, so the
 * current member's id is a parameter. Getting this backwards shows every member
 * their own name on every card — worth the explicit argument.
 *
 * `scheduled_for` arrives as an ISO string and becomes a Date here. Strings
 * that are really dates are a recurring source of bugs (sorting a list of ISO
 * strings works, right up to a time zone offset appearing).
 */

const toStatus = (value: string): MeetStatus =>
  (MEET_STATUSES as readonly string[]).includes(value) ? (value as MeetStatus) : 'pending';

export type MeetRowWithPerson = MeetRow & {
  /** Joined from `profiles`. Absent when the join was not requested. */
  person_name?: string;
  person_photo_url?: string | null;
};

export function toMeet(row: MeetRowWithPerson, currentUserId: string): Meet {
  const otherId = row.requester_id === currentUserId ? row.recipient_id : row.requester_id;

  return {
    id: row.id,
    personId: otherId,
    personName: row.person_name ?? 'Member',
    ...(row.person_photo_url ? { personPhotoUrl: row.person_photo_url } : {}),
    venueName: row.venue_name,
    venueArea: row.venue_area,
    scheduledFor: new Date(row.scheduled_for),
    status: toStatus(row.status),
  };
}
