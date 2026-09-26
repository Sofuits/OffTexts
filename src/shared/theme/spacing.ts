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

/**
 * Corner radii. One squircle family, 10–20dp, for nearly everything — Breeze's
 * buttons, fields, tiles and cards measure 12–16dp, and none of them are pills.
 * `full` is for avatars and progress segments only.
 */
export const radii = {
  none: 0,
  /** Checkboxes, small controls. */
  sm: 10,
  /** Chips. */
  md: 14,
  /** Buttons, icon tiles, fields, cards. */
  lg: 16,
  /** Large cards, sheets. */
  xl: 20,
  /** Avatars only. */
  full: 999,
} as const;

export type Radii = typeof radii;
export type RadiusToken = keyof Radii;

/**
 * Control heights, from Breeze's screenshots measured in dp. Chips are 44
 * rather than Breeze's 39 so every interactive element clears `minTouchTarget`.
 */
export const sizes = {
  nextButton: 48,
  iconTile: 52,
  field: 52,
  /** The band under a focused field. */
  fieldFocusBand: 5,
  chip: 44,
  optionRow: 64,
  cta: 48,
  ctaXl: 56,
} as const;

export type Sizes = typeof sizes;

/**
 * Minimum touch target. Below 44dp, taps start getting missed — both Apple's
 * and Google's guidelines land around this number.
 */
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const minTouchTarget = 44;
