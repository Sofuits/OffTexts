import React from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';

import logo from '@/assets/images/offtexts-logo.png';

export type LogoProps = {
  /** Rendered width and height in dp. The artwork is square. */
  size?: number;
  style?: ViewStyle;
};

/**
 * The Offtexts mark.
 *
 * The artwork carries its own dark background, so it is clipped to a rounded
 * square and sits on the app background without a visible edge.
 */
export function Logo({ size = 40, style }: LogoProps): React.JSX.Element {
  return (
    <View
      style={[{ width: size, height: size, borderRadius: size * 0.28 }, styles.clip, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Offtexts"
    >
      <Image
        source={logo}
        style={styles.image}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
