import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/presentation/hooks/useTheme';

export type IconTileProps = {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  /** Brass on moss by default; `plain` drops the tile and keeps the glyph. */
  variant?: 'tile' | 'plain';
  style?: ViewStyle;
};

/**
 * A single icon in a rounded square.
 *
 * It sits above the question on every onboarding step and does one job: give
 * the eye somewhere to land before it reads. A step with nothing above the
 * question reads as a form; the same step with a tile reads as a conversation,
 * and people finish those.
 *
 * Decorative by definition, so it is hidden from screen readers — the question
 * underneath already says what the step is about, and an icon announcing
 * "gift" before "When's your birthday?" is noise.
 */
export function IconTile({
  name,
  size = 52,
  variant = 'tile',
  style,
}: IconTileProps): React.JSX.Element {
  const theme = useTheme();
  const glyph = Math.round(size * 0.46);

  if (variant === 'plain') {
    return (
      <View
        style={style}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons name={name} size={glyph} color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.inset,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      <Ionicons name={name} size={glyph} color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
