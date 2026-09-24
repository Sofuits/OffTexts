import type { TextStyle } from 'react-native';

/**
 * Type scale.
 *
 * `AppText` takes a `variant` from here, so a screen never sets fontSize or
 * fontWeight by hand.
 *
 * Sizes are Breeze's measured proportions, not its screenshot pixels (716px on
 * a 393dp device is 1.82px per dp). The one deliberate deviation is `heading`:
 * Breeze's question is ~25dp; ours is 28 because our strings are longer.
 *
 * No letter-spacing anywhere. Breeze's text runs slightly wider than every free
 * candidate, so tightening it moves the wrong way.
 */

export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 15,
  md: 17,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const lineHeights = {
  tight: 1.2,
  normal: 1.45,
  relaxed: 1.6,
} as const;

/**
 * Figtree for all UI, Fraunces 800 for hero moments only. `undefined` is the
 * platform's system font — these stay unset until `expo-font` loads the faces
 * and first render is gated on `useFonts`, because naming an unregistered
 * family makes iOS warn and every platform fall back anyway.
 */
export const fontFamilies = {
  regular: undefined,
  medium: undefined,
  semibold: undefined,
  bold: undefined,
  /** Hero moments ONLY. Never an onboarding question. */
  serif: undefined,
} as const satisfies Record<string, TextStyle['fontFamily']>;

const scale = (size: number, ratio: number): number => Math.round(size * ratio);

export const typography = {
  /** Welcome, done, the match moment. The only serif in the app. */
  hero: {
    fontSize: fontSizes.display,
    fontWeight: fontWeights.extrabold,
    lineHeight: scale(fontSizes.display, lineHeights.tight),
    fontFamily: fontFamilies.serif,
  },
  display: {
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    lineHeight: scale(fontSizes.display, lineHeights.tight),
    fontFamily: fontFamilies.bold,
  },
  /** The onboarding question and screen titles. */
  heading: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    lineHeight: scale(fontSizes.xxl, lineHeights.tight),
    fontFamily: fontFamilies.bold,
  },
  /** Section titles. */
  subheading: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    lineHeight: scale(fontSizes.xl, lineHeights.tight),
    fontFamily: fontFamilies.bold,
  },
  /** Option labels, chip labels, list rows. */
  title: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: scale(fontSizes.lg, lineHeights.normal),
    fontFamily: fontFamilies.semibold,
  },
  body: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    lineHeight: scale(fontSizes.md, lineHeights.normal),
    fontFamily: fontFamilies.regular,
  },
  bodyStrong: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: scale(fontSizes.md, lineHeights.normal),
    fontFamily: fontFamilies.semibold,
  },
  /** Field labels. */
  label: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    lineHeight: scale(fontSizes.base, lineHeights.normal),
    fontFamily: fontFamilies.medium,
  },
  /** Privacy notes and small print — 14, not 12. */
  caption: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: scale(fontSizes.sm, lineHeights.normal),
    fontFamily: fontFamilies.regular,
  },
  button: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: scale(fontSizes.md, lineHeights.tight),
    fontFamily: fontFamilies.semibold,
  },
} as const satisfies Record<string, TextStyle>;

export type Typography = typeof typography;
export type TypographyVariant = keyof Typography;
