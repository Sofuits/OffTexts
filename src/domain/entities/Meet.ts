import type { PersonId } from './Person';

/** A booked meeting between two members. */

export type MeetId = string;

export const MEET_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const;
export type MeetStatus = (typeof MEET_STATUSES)[number];

export type Meet = {
  id: MeetId;
  /** The other person. The current user is implied by who is asking. */
  personId: PersonId;
  personName: string;
  personPhotoUrl?: string;
  venueName: string;
  venueArea: string;
  /** Absolute instant. Time zones are a display concern, not a storage one. */
  scheduledFor: Date;
  status: MeetStatus;
};

/**
 * Whether a meet belongs in "Upcoming" or in "History".
 *
 * This lives in the domain rather than in the screen because it is a business
 * rule: a confirmed meet whose time has passed is history even though its
 * status still says confirmed, and every client must agree on that.
 */
export function isUpcoming(meet: Meet, now: Date = new Date()): boolean {
  if (meet.status === 'cancelled' || meet.status === 'completed') return false;
  return meet.scheduledFor.getTime() >= now.getTime();
}

export function isHistory(meet: Meet, now: Date = new Date()): boolean {
  return !isUpcoming(meet, now);
}
