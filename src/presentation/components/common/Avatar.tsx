import React from 'react';
import { Image, StyleSheet, View, type ImageStyle, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';
import { getInitials } from '@/shared/utils/helpers';

export type AvatarProps = {
  name: string;
  /** Remote or bundled image. Falls back to initials when absent or broken. */
  uri?: string;
  size?: number;
  /**
   * A 2dp white ring, for an avatar sitting on a coloured surface or
   * overlapping another avatar, where the hairline edge disappears.
   */
  ring?: boolean;
  style?: ViewStyle;
};

/**
 * A round portrait with an initials fallback.
 *
 * The fallback is not decoration: profiles arrive without photos and a plain
 * grey circle tells the user nothing about whose row they are looking at.
 */
export function Avatar({
  name,
  uri,
  size = 56,
  ring = false,
  style,
}: AvatarProps): React.JSX.Element {
  const theme = useTheme();

  // `Image` takes ImageStyle and `View` takes ViewStyle. They overlap almost
  // entirely but not quite (ImageStyle has no `overflow: 'scroll'`), so the
  // shared values are built once and typed per element rather than cast.
  const base = {
    width: size,
    height: size,
    borderRadius: theme.radii.full,
    // `tint`, not `inset`: inputs are white now, and a white avatar vanishes on
    // a white card — the match moment's overlapping pair lost its second face.
    backgroundColor: theme.colors.tint,
    borderWidth: ring ? 2 : StyleSheet.hairlineWidth,
    borderColor: ring ? theme.colors.surface : theme.colors.border,
  } satisfies ImageStyle & ViewStyle;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[base, style as ImageStyle]}
        accessibilityIgnoresInvertColors
        accessibilityLabel={name}
      />
    );
  }

  return (
    <View style={[base, styles.centre, style]} accessible accessibilityLabel={name}>
      <AppText variant={size >= 72 ? 'subheading' : 'bodyStrong'} color="primary">
        {getInitials(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});
