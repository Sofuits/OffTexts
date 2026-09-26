import { Platform, type ViewStyle } from 'react-native';

/**
 * Elevation tokens.
 *
 * iOS and Android express depth differently — iOS wants shadowColor/Offset/
 * Opacity/Radius, Android wants a single `elevation` number — so each level
 * ships both and `Platform.select` picks. Using only `elevation` gives nothing
 * on iOS; using only the shadow props gives nothing on Android.
 *
 * A shadow needs a background colour on the same view to render on Android.
 */

type Elevation = 'none' | 'sm' | 'md' | 'lg';

// A warm brown rather than black: on cream, a black shadow reads as grime. The
// mockups use a very soft shadow on cards and nothing else — white on cream is
// most of the separation, and there is no coloured offset layer.
const shadowColor = '#5B5136';

const ios: Record<Elevation, ViewStyle> = {
  none: {},
  sm: {
    shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  md: {
    shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  lg: {
    shadowColor,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
  },
};

const android: Record<Elevation, ViewStyle> = {
  none: { elevation: 0 },
  sm: { elevation: 1 },
  md: { elevation: 3 },
  lg: { elevation: 6 },
};

const pick = (level: Elevation): ViewStyle =>
  Platform.select({ ios: ios[level], android: android[level], default: ios[level] });

export const shadows = {
  none: pick('none'),
  sm: pick('sm'),
  md: pick('md'),
  lg: pick('lg'),
} as const satisfies Record<Elevation, ViewStyle>;

export type Shadows = typeof shadows;
export type ShadowToken = keyof Shadows;
