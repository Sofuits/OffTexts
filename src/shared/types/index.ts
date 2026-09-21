/**
 * Types with no home of their own.
 *
 * Domain shapes live in `domain/entities`, not here. This is for cross-cutting
 * helpers — the kind of thing several layers need and none owns.
 */

/** Every property, however deeply nested, becomes optional. */
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/** A value that may not have arrived yet. */
export type Maybe<T> = T | null | undefined;

/** Narrows away null and undefined, and works as a `.filter()` predicate. */
export function isDefined<T>(value: Maybe<T>): value is T {
  return value !== null && value !== undefined;
}
