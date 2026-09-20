/**
 * Spacing scale, in density-independent pixels.
 *
 * Every margin, padding and gap in the app comes from this scale. The keys are
 * the values, which keeps call sites literal (`spacing[16]`) without letting an
 * arbitrary number in — `spacing[15]` does not typecheck.
 */
export const spacing = {
  0: 0,
  2: 2,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
} as const;

export type Spacing = typeof spacing;
export type SpacingToken = keyof Spacing;

/** Corner radii. `full` is deliberately large so it pills any height. */
export const radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export type Radii = typeof radii;
export type RadiusToken = keyof Radii;

/**
 * Minimum touch target. Below 44dp, taps start getting missed — both Apple's
 * and Google's guidelines land around this number.
 */
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const minTouchTarget = 44;
