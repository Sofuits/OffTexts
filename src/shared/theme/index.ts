import { colors } from './colors';
import { shadows } from './shadows';
import { hitSlop, minTouchTarget, radii, sizes, spacing } from './spacing';
import { fontFamilies, fontSizes, fontWeights, lineHeights, typography } from './typography';

export * from './colors';
export * from './shadows';
export * from './spacing';
export * from './typography';

/**
 * The single theme object.
 *
 * Read it through `useTheme()` rather than importing it directly in a component,
 * so that swapping in a dark palette later is a change in one provider instead
 * of a change in every file.
 */
export const theme = {
  colors,
  spacing,
  radii,
  sizes,
  typography,
  shadows,
  fontSizes,
  fontWeights,
  lineHeights,
  fontFamilies,
  hitSlop,
  minTouchTarget,
} as const;

export type Theme = typeof theme;
