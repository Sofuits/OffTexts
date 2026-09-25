/**
 * Two members' free days, side by side.
 *
 * PROVISIONAL. This is the date half of the mutual scheduling flow
 * (docs/design/scheduling-flow.md) without its backend: there is nowhere yet
 * to store one member's dates where the other can read them, so the other
 * member's dates come from a placeholder (see `DateSharingRepository`). When
 * the schema lands, the intersection moves to the server — the spec is
 * explicit that the phone must not compute it — and `sharedDateRows` goes.
 */

/** `YYYY-MM-DD` in the member's calendar; see `DateKey` in shared/utils/calendar. */
export type DayKey = string;

export type OtherMemberDates = {
  /** What to call them on screen. */
  name: string;
  dates: DayKey[];
  /**
   * True while the dates are invented on the phone rather than chosen by a
   * person. Screens must say so; see the placeholder notice.
   */
  isPlaceholder: boolean;
};

export type SharedDateRow = {
  date: DayKey;
  mine: boolean;
  theirs: boolean;
  /** Both free: the rows the next step chooses from. */
  both: boolean;
};

/**
 * Every date either of us marked, earliest first.
 *
 * In date order, whatever order they were tapped in: a table that lists the
 * 14th above the 3rd because the 14th was tapped first reads as a mistake.
 */
export function sharedDateRows(mine: DayKey[], theirs: DayKey[]): SharedDateRow[] {
  const mineSet = new Set(mine);
  const theirSet = new Set(theirs);

  return [...new Set([...mine, ...theirs])].sort().map((date) => {
    const isMine = mineSet.has(date);
    const isTheirs = theirSet.has(date);
    return { date, mine: isMine, theirs: isTheirs, both: isMine && isTheirs };
  });
}

/** The dates both of us are free, earliest first. */
export function bothFree(rows: SharedDateRow[]): DayKey[] {
  return rows.filter((row) => row.both).map((row) => row.date);
}
