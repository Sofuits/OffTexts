import { fromDateKey, isBeforeDay, monthGrid, toDateKey } from '@/shared/utils/calendar';

describe('calendar helpers', () => {
  it('keys a date by its local calendar day', () => {
    // 23:30 local on the 3rd is still the 3rd, whatever UTC says.
    expect(toDateKey(new Date(2026, 9, 3, 23, 30))).toBe('2026-10-03');
    expect(toDateKey(new Date(2026, 0, 9))).toBe('2026-01-09');
  });

  it('reads a key back as local midnight, not UTC midnight', () => {
    const date = fromDateKey('2026-10-03');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(3);
    expect(date.getHours()).toBe(0);
    expect(toDateKey(fromDateKey('2026-02-28'))).toBe('2026-02-28');
  });

  it('lays a month out Sunday first, blanks before the 1st', () => {
    // 1 October 2026 is a Thursday: four blanks, then 31 days.
    const cells = monthGrid(2026, 9);

    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4] && toDateKey(cells[4])).toBe('2026-10-01');
    expect(cells).toHaveLength(4 + 31);
    expect(monthGrid(2027, 1)).toHaveLength(1 + 28); // February 2027 starts on a Monday
  });

  it('compares calendar days, ignoring the time of day', () => {
    const today = new Date(2026, 9, 3, 9, 0);

    expect(isBeforeDay(new Date(2026, 9, 2, 23, 59), today)).toBe(true);
    expect(isBeforeDay(new Date(2026, 9, 3, 0, 0), today)).toBe(false);
    expect(isBeforeDay(new Date(2026, 9, 4), today)).toBe(false);
  });
});
