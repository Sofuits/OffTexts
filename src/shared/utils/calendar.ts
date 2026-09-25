/**
 * Calendar days, as the month grid and the date-sharing screens use them.
 *
 * `toDateKey` and `monthGrid` are ported from `getMonthDays` / `toDateKey` in
 * `AvailabilitySelectDatesScreen.tsx` on `feature/shared-availability-dates`
 * (juiwaykole2005). The logic is theirs; the names, the types and
 * `fromDateKey`/`isBeforeDay` are new.
 */

/**
 * A calendar day in the member's own calendar, as `YYYY-MM-DD`.
 *
 * Not an instant. "Saturday the 3rd" is the same day wherever the phone is, and
 * turning it into a `Date` at UTC midnight is how it becomes Friday the 2nd
 * west of Greenwich. Build one with `toDateKey`, read one with `fromDateKey`.
 */
export type DateKey = string;

/** The day `date` falls on in local time. Local getters, never `toISOString()`. */
export function toDateKey(date: Date): DateKey {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Local midnight on that day. Not `new Date(key)`: a bare `YYYY-MM-DD` is
 * parsed as UTC midnight, which is the previous evening anywhere west of it.
 */
export function fromDateKey(key: DateKey): Date {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * One month as calendar cells, Sunday first: `null` for the blanks before the
 * 1st, then one `Date` per day. `month` is 0-based, as in `Date`.
 */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let blank = 0; blank < first.getDay(); blank += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  return cells;
}

/** Whether `day` is an earlier calendar day than `today`. Times of day are ignored. */
export function isBeforeDay(day: Date, today: Date): boolean {
  return toDateKey(day) < toDateKey(today);
}
