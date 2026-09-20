import React, { useMemo } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/presentation/hooks/useTheme';
import type { ColorToken, TypographyVariant } from '@/shared/theme';

export type AppTextProps = TextProps & {
  /** Which entry of the type scale to use. */
  variant?: TypographyVariant;
  /** A colour token, never a raw hex value. */
  color?: ColorToken;
  align?: TextStyle['textAlign'];
};

/**
 * Every piece of text in the app.
 *
 * Using this instead of `Text` is what keeps font sizes and colours out of
 * screens: a variant and a colour token are the only choices a caller makes.
 */
export function AppText({
  variant = 'body',
  color = 'textPrimary',
  align,
  style,
  children,
  ...rest
}: AppTextProps): React.JSX.Element {
  const theme = useTheme();

  const computed = useMemo<TextStyle>(
    () => ({
      ...theme.typography[variant],
      color: theme.colors[color],
      ...(align ? { textAlign: align } : null),
    }),
    [theme, variant, color, align],
  );

  return (
    <Text style={StyleSheet.flatten([computed, style])} {...rest}>
      {children}
    </Text>
  );
}
