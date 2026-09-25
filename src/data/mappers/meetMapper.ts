import { MEET_STATUSES, type Meet, type MeetStatus } from '@/domain/entities';
import type { MeetingRow } from '@/infrastructure/supabase/rows';

/**
 * Converts an `api_v1.meetings` row into a `Meet`.
 *
 * The view does the part that is easy to get wrong: it resolves "the other
 * person" for whoever is asking (`with_*` columns), so neither this mapper nor
 * the repository decides which of requester and recipient to show. The
 * previous version read the table and embedded the recipient's profile —
 * which named the wrong person whenever the caller was the recipient, and was
 * read back under a key the embed never produced, so every card said
 * "Member".
 *
 * Every column of a view is typed nullable, because PostgREST cannot prove
 * otherwise. The join guarantees a name and an id; the fallbacks are for the
 * type, not for a case that happens.
 *
 * `scheduled_for` arrives as an ISO string and becomes a Date here. Strings
 * that are really dates are a recurring source of bugs (sorting a list of ISO
 * strings works, right up to a time zone offset appearing).
 */

const toStatus = (value: string | null): MeetStatus =>
  value && (MEET_STATUSES as readonly string[]).includes(value) ? (value as MeetStatus) : 'pending';

export function toMeet(row: MeetingRow): Meet {
  const photo = row.with_photo_urls?.[0];

  return {
    id: row.meeting_id ?? '',
    personId: row.with_member_id ?? '',
    personName: row.with_name ?? 'Member',
    ...(photo ? { personPhotoUrl: photo } : {}),
    venueName: row.venue_name ?? '',
    venueArea: row.venue_area ?? '',
    scheduledFor: new Date(row.scheduled_for ?? 0),
    status: toStatus(row.status),
  };
}
