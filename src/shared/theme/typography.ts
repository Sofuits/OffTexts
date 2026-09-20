import type { TextStyle } from 'react-native';

/**
 * Type scale.
 *
 * `AppText` takes a `variant` from here, so a screen never sets fontSize or
 * fontWeight by hand. Swapping in a custom font later means changing
 * `fontFamily` in one place per weight.
 */

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
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
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const lineHeights = {
  tight: 1.2,
  normal: 1.45,
  relaxed: 1.6,
} as const;

/**
 * Set these once a custom font is added to `src/assets/fonts` and loaded with
 * `expo-font`. `undefined` means the platform's system font, which is the right
 * default until a brand font exists.
 */
export const fontFamilies = {
  regular: undefined,
  medium: undefined,
  semibold: undefined,
  bold: undefined,
} as const satisfies Record<string, TextStyle['fontFamily']>;

const scale = (size: number, ratio: number): number => Math.round(size * ratio);

export const typography = {
  display: {
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    lineHeight: scale(fontSizes.display, lineHeights.tight),
    fontFamily: fontFamilies.bold,
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    lineHeight: scale(fontSizes.xxl, lineHeights.tight),
    fontFamily: fontFamilies.bold,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: scale(fontSizes.xl, lineHeights.tight),
    fontFamily: fontFamilies.semibold,
  },
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
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: scale(fontSizes.sm, lineHeights.normal),
    fontFamily: fontFamilies.medium,
  },
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.regular,
    lineHeight: scale(fontSizes.xs, lineHeights.normal),
    fontFamily: fontFamilies.regular,
  },
  button: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: scale(fontSizes.md, lineHeights.tight),
    fontFamily: fontFamilies.semibold,
    letterSpacing: 0.2,
  },
} as const satisfies Record<string, TextStyle>;

export type Typography = typeof typography;
export type TypographyVariant = keyof Typography;
