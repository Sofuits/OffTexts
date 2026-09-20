/**
 * Date formatting, written by hand rather than with `Intl`.
 *
 * WHY NOT Intl: Hermes — the JavaScript engine React Native uses — implements
 * only part of `Intl` on Android. `Intl.DateTimeFormat` is there;
 * `Intl.RelativeTimeFormat` is NOT, and calling it throws
 * "Intl.RelativeTimeFormat is not a constructor", which takes the whole screen
 * down. It works in the iOS simulator and in web previews, so the failure only
 * shows up on a real Android device — which is exactly how it was found.
 *
 * Formatting by hand costs a few lines and removes a class of engine-dependent
 * crashes. Every function here also returns '' for an unparseable date instead
 * of throwing, so one bad record can never blank a list.
 */

/** An ISO-8601 timestamp. Kept local so `shared` does not depend on `domain`. */
export type ISODateString = string;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const toDate = (value: ISODateString | Date): Date =>
  value instanceof Date ? value : new Date(value);

const isValid = (date: Date): boolean => !Number.isNaN(date.getTime());

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** `12 Mar 2026` */
export function formatDate(value: ISODateString | Date): string {
  const date = toDate(value);
  if (!isValid(date)) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** `Thu, 12 Mar` */
export function formatDayAndDate(value: ISODateString | Date): string {
  const date = toDate(value);
  if (!isValid(date)) return '';
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** `4:30 pm` */
export function formatTime(value: ISODateString | Date): string {
  const date = toDate(value);
  if (!isValid(date)) return '';
  const hours = date.getHours();
  const suffix = hours < 12 ? 'am' : 'pm';
  // 0 and 12 both display as 12.
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${pad2(date.getMinutes())} ${suffix}`;
}

/** `12 Mar 2026 · 4:30 pm` */
export function formatDateTime(value: ISODateString | Date): string {
  const date = toDate(value);
  if (!isValid(date)) return '';
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/**
 * `in 3 days`, `2 hours ago`, `today`. Past a month it gives the date, because
 * "in 47 days" is harder to read than "12 Mar 2026".
 */
export function formatRelative(value: ISODateString | Date): string {
  const date = toDate(value);
  if (!isValid(date)) return '';

  const diffMs = date.getTime() - Date.now();
  const future = diffMs >= 0;
  const absMinutes = Math.round(Math.abs(diffMs) / 60_000);

  const phrase = (count: number, unit: string): string => {
    const plural = count === 1 ? unit : `${unit}s`;
    return future ? `in ${count} ${plural}` : `${count} ${plural} ago`;
  };

  if (absMinutes < 1) return 'just now';
  if (absMinutes < 60) return phrase(absMinutes, 'minute');

  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) return phrase(absHours, 'hour');

  const absDays = Math.round(absHours / 24);
  if (absDays === 1) return future ? 'tomorrow' : 'yesterday';
  if (absDays <= 30) return phrase(absDays, 'day');

  return formatDate(date);
}

/** True when the instant has passed. */
export function isPast(value: ISODateString | Date): boolean {
  const date = toDate(value);
  return isValid(date) && date.getTime() < Date.now();
}
