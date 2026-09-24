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
 * Figtree for all UI, Fraunces 800 for hero moments only. The names are the
 * keys `app/App.tsx` loads with `useFonts`; the two must stay in step.
 *
 * Each weight is its own family, which is why the variants below set a family
 * and no `fontWeight`. Asking for weight 700 of a family that is already the
 * bold face makes Android and the web synthesise bold on top of it.
 */
export const fontFamilies = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  /** Hero moments ONLY. Never an onboarding question. */
  serif: 'Fraunces_800ExtraBold',
} as const satisfies Record<string, TextStyle['fontFamily']>;

const scale = (size: number, ratio: number): number => Math.round(size * ratio);

export const typography = {
  /** Welcome, done, the match moment. The only serif in the app. */
  hero: {
    fontSize: fontSizes.display,
    lineHeight: scale(fontSizes.display, lineHeights.tight),
    fontFamily: fontFamilies.serif,
  },
  display: {
    fontSize: fontSizes.display,
    lineHeight: scale(fontSizes.display, lineHeights.tight),
    fontFamily: fontFamilies.bold,
  },
  /** The onboarding question and screen titles. */
  heading: {
    fontSize: fontSizes.xxl,
    lineHeight: scale(fontSizes.xxl, lineHeights.tight),
    fontFamily: fontFamilies.bold,
  },
  /** Section titles. */
  subheading: {
    fontSize: fontSizes.xl,
    lineHeight: scale(fontSizes.xl, lineHeights.tight),
    fontFamily: fontFamilies.bold,
  },
  /** Option labels, chip labels, list rows. */
  title: {
    fontSize: fontSizes.lg,
    lineHeight: scale(fontSizes.lg, lineHeights.normal),
    fontFamily: fontFamilies.semibold,
  },
  body: {
    fontSize: fontSizes.md,
    lineHeight: scale(fontSizes.md, lineHeights.normal),
    fontFamily: fontFamilies.regular,
  },
  bodyStrong: {
    fontSize: fontSizes.md,
    lineHeight: scale(fontSizes.md, lineHeights.normal),
    fontFamily: fontFamilies.semibold,
  },
  /** Field labels. */
  label: {
    fontSize: fontSizes.base,
    lineHeight: scale(fontSizes.base, lineHeights.normal),
    fontFamily: fontFamilies.medium,
  },
  /** Privacy notes and small print — 14, not 12. */
  caption: {
    fontSize: fontSizes.sm,
    lineHeight: scale(fontSizes.sm, lineHeights.normal),
    fontFamily: fontFamilies.regular,
  },
  button: {
    fontSize: fontSizes.md,
    lineHeight: scale(fontSizes.md, lineHeights.tight),
    fontFamily: fontFamilies.semibold,
  },
} as const satisfies Record<string, TextStyle>;

export type Typography = typeof typography;
export type TypographyVariant = keyof Typography;
