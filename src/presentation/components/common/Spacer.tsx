import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/presentation/hooks/useTheme';
import type { SpacingToken } from '@/shared/theme';

export type SpacerProps = {
  /** A step on the spacing scale. */
  size?: SpacingToken;
  /** `vertical` adds height, `horizontal` adds width. */
  axis?: 'vertical' | 'horizontal';
  /** Take up the remaining space instead of a fixed size. */
  flex?: boolean;
};

/**
 * Blank space between elements.
 *
 * It exists so that gaps come from the spacing scale rather than from stray
 * margins, and so a stack's spacing is visible in the JSX rather than hidden in
 * a stylesheet.
 */
export function Spacer({
  size = 16,
  axis = 'vertical',
  flex = false,
}: SpacerProps): React.JSX.Element {
  const theme = useTheme();
  const value = theme.spacing[size];

  return (
    <View
      // Spacing is decorative; a screen reader should skip straight past it.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={flex ? { flex: 1 } : axis === 'vertical' ? { height: value } : { width: value }}
    />
  );
}
