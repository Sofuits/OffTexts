import { toVenue } from '@/data/mappers';
import { isOpenOn, startTimesOn } from '@/domain/entities';
import type { VenueRow } from '@/infrastructure/supabase/rows';

/** An api_v1.venues row as PostgREST returns it: ISO weekdays, 1 = Monday … 7 = Sunday. */
function row(hours: unknown): VenueRow {
  return {
    id: 'cafe-1',
    name: 'Fern & Filter (demo)',
    slug: 'demo-fern-and-filter',
    address_line: 'Not a real address',
    area: 'Baner',
    city: 'Pune',
    latitude: null,
    longitude: null,
    maps_url: null,
    concurrent_meet_capacity: 2,
    hours,
  } as VenueRow;
}

const hour = (weekday: unknown, opens = '09:00:00', closes = '17:00:00') => ({
  weekday,
  opens_at: opens,
  closes_at: closes,
});

describe('toVenue hours', () => {
  it("converts ISO Sunday (7) to JavaScript's Sunday (0)", () => {
    const venue = toVenue(row([hour(7)]));

    expect(venue.hours).toEqual([{ weekday: 0, opensAt: '09:00:00', closesAt: '17:00:00' }]);
  });

  it('keeps Monday to Saturday, which are the same number in both', () => {
    const venue = toVenue(row([1, 2, 3, 4, 5, 6].map((day) => hour(day))));

    expect(venue.hours.map((interval) => interval.weekday)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('drops what is not an ISO weekday rather than guessing', () => {
    const venue = toVenue(row([hour(0), hour(8), hour(2.5), hour('1'), hour(null)]));

    expect(venue.hours).toEqual([]);
  });

  it('offers slots on a Sunday for a café open on Sundays', () => {
    // Before the conversion this café looked shut every Sunday.
    const venue = toVenue(row([hour(7, '09:00:00', '14:00:00')]));
    const sunday = new Date(2026, 8, 27); // 27 September 2026, a Sunday

    expect(sunday.getDay()).toBe(0);
    expect(isOpenOn(venue, sunday.getDay())).toBe(true);
    expect(startTimesOn(venue, sunday.getDay(), 60)).toEqual([540, 600, 660, 720, 780]);
  });

  it('shows a café closed on the day it has no hours', () => {
    const venue = toVenue(row([2, 3, 4, 5, 6, 7].map((day) => hour(day))));
    const monday = new Date(2026, 8, 28);

    expect(isOpenOn(venue, monday.getDay())).toBe(false);
    expect(isOpenOn(venue, 0)).toBe(true);
  });
});
