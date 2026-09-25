/**
 * A partner café.
 *
 * Offtexts does not host meetings; cafés do. A venue is therefore not a detail
 * of a meeting — it is the thing that makes a meeting possible, and a member
 * choosing one is choosing a neighbourhood, a price bracket and a Tuesday
 * evening all at once.
 *
 * What is absent is as deliberate as what is here: no phone number, no manager,
 * no commission rate, no Razorpay account. Those live on `cafe_contacts` and
 * `cafes` and are staff-facing — `api_v1.venues` does not publish them, so this
 * type has nowhere to put them even by accident.
 */

export type VenueId = string;

/**
 * One opening interval.
 *
 * `weekday` follows JavaScript's `Date.getDay()`: 0 is Sunday. The API sends
 * ISO numbering (7 is Sunday); `toVenue` converts. A café may have
 * several intervals on one day — a lunch closure is two rows, not one row with
 * a hole in it — so anything reading these must handle more than one per day.
 */
export type OpeningHours = {
  weekday: number;
  /** `HH:MM:SS` in the café's local time. Not an instant. */
  opensAt: string;
  closesAt: string;
};

export type Venue = {
  id: VenueId;
  name: string;
  slug: string;
  addressLine: string;
  area: string;
  city: string;
  latitude?: number;
  longitude?: number;
  /** A link the phone can hand to a maps app. */
  mapsUrl?: string;
  /** How many Offtexts meetings this café will host at once. */
  concurrentCapacity: number;
  hours: OpeningHours[];
};

/** The intervals this venue is open on a given weekday, earliest first. */
export function hoursOn(venue: Venue, weekday: number): OpeningHours[] {
  return venue.hours
    .filter((interval) => interval.weekday === weekday)
    .sort((a, b) => a.opensAt.localeCompare(b.opensAt));
}

export function isOpenOn(venue: Venue, weekday: number): boolean {
  return hoursOn(venue, weekday).length > 0;
}

/** `09:30:00` -> minutes since midnight. Returns null for anything unparseable. */
export function minutesFromClock(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(clock);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Bookable start times on a given day, as whole hours.
 *
 * The last start is `durationMinutes` before closing, because a table booked
 * ten minutes before the café shuts is a booking nobody can keep. Rounding up
 * to the next whole hour keeps the list short enough to tap through — a café
 * open twelve hours would otherwise offer forty-eight quarter-hour slots, and
 * nobody has a preference between 4:15 and 4:30.
 */
export function startTimesOn(venue: Venue, weekday: number, durationMinutes: number): number[] {
  const starts: number[] = [];

  for (const interval of hoursOn(venue, weekday)) {
    const opens = minutesFromClock(interval.opensAt);
    const closes = minutesFromClock(interval.closesAt);
    if (opens === null || closes === null || closes <= opens) continue;

    const firstWholeHour = Math.ceil(opens / 60) * 60;
    const lastStart = closes - durationMinutes;

    for (let minute = firstWholeHour; minute <= lastStart; minute += 60) {
      starts.push(minute);
    }
  }

  return [...new Set(starts)].sort((a, b) => a - b);
}
