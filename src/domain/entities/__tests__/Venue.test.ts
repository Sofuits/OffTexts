import { hoursOn, isOpenOn, minutesFromClock, startTimesOn, type Venue } from '@/domain/entities';

/**
 * Bookable slots.
 *
 * This arithmetic decides what a member is offered on the booking screen, and
 * every failure mode of it is a booking somebody cannot keep: a table ten
 * minutes before closing, a slot on a day the café is shut, a start time that
 * does not exist. Cheap to test, and impossible to eyeball.
 */

const venue = (hours: Venue['hours']): Venue => ({
  id: 'venue-1',
  name: 'The Daily Grind',
  slug: 'the-daily-grind',
  addressLine: '12 Baner Road',
  area: 'Baner',
  city: 'Pune',
  concurrentCapacity: 2,
  hours,
});

describe('minutesFromClock', () => {
  it('reads a Postgres time', () => {
    expect(minutesFromClock('09:30:00')).toBe(570);
    expect(minutesFromClock('00:00:00')).toBe(0);
    expect(minutesFromClock('23:59')).toBe(1439);
  });

  it('returns null rather than NaN for anything it cannot read', () => {
    // NaN would propagate silently into the slot arithmetic and produce an
    // empty list that looks like "closed" rather than "bad data".
    expect(minutesFromClock('')).toBeNull();
    expect(minutesFromClock('nine')).toBeNull();
    expect(minutesFromClock('25:00:00')).toBeNull();
    expect(minutesFromClock('09:75:00')).toBeNull();
  });
});

describe('opening hours', () => {
  it('reports the intervals for one weekday, earliest first', () => {
    const cafe = venue([
      { weekday: 2, opensAt: '15:00:00', closesAt: '21:00:00' },
      { weekday: 2, opensAt: '08:00:00', closesAt: '12:00:00' },
      { weekday: 3, opensAt: '08:00:00', closesAt: '21:00:00' },
    ]);

    expect(hoursOn(cafe, 2).map((interval) => interval.opensAt)).toEqual(['08:00:00', '15:00:00']);
    expect(isOpenOn(cafe, 2)).toBe(true);
    expect(isOpenOn(cafe, 1)).toBe(false);
  });
});

describe('startTimesOn', () => {
  it('offers whole hours from opening', () => {
    const cafe = venue([{ weekday: 1, opensAt: '09:00:00', closesAt: '12:00:00' }]);

    // 9, 10, 11 — and not 12, because an hour-long meet starting at noon runs
    // past closing.
    expect(startTimesOn(cafe, 1, 60)).toEqual([540, 600, 660]);
  });

  it('starts at the first whole hour after a half-past opening', () => {
    const cafe = venue([{ weekday: 1, opensAt: '09:30:00', closesAt: '12:30:00' }]);

    // 10 and 11. Offering 9:30 would be right too, but a list of :00 and :30
    // times is twice as long for a choice nobody has a preference about.
    expect(startTimesOn(cafe, 1, 60)).toEqual([600, 660]);
  });

  it('leaves room for the whole meeting before closing', () => {
    const cafe = venue([{ weekday: 1, opensAt: '09:00:00', closesAt: '11:30:00' }]);

    // 10:30 would end at 11:30 exactly, which is allowed; 11:00 would not.
    // The list is whole hours, so 9 and 10.
    expect(startTimesOn(cafe, 1, 60)).toEqual([540, 600]);
    // A shorter meeting fits one more in.
    expect(startTimesOn(cafe, 1, 30)).toEqual([540, 600, 660]);
  });

  it('merges two intervals on the same day without repeating an hour', () => {
    const cafe = venue([
      { weekday: 1, opensAt: '08:00:00', closesAt: '11:00:00' },
      // A lunch closure is two rows, and the second one reopens mid-hour.
      { weekday: 1, opensAt: '10:30:00', closesAt: '13:00:00' },
    ]);

    expect(startTimesOn(cafe, 1, 60)).toEqual([480, 540, 600, 660, 720]);
  });

  it('offers nothing on a day the venue is shut', () => {
    const cafe = venue([{ weekday: 2, opensAt: '09:00:00', closesAt: '21:00:00' }]);
    expect(startTimesOn(cafe, 1, 60)).toEqual([]);
  });

  it('ignores an interval that closes before it opens', () => {
    // A café open past midnight is stored as two rows on two weekdays, so a
    // single row like this is bad data rather than an overnight shift.
    const cafe = venue([{ weekday: 1, opensAt: '20:00:00', closesAt: '02:00:00' }]);
    expect(startTimesOn(cafe, 1, 60)).toEqual([]);
  });
});
