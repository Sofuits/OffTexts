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

// Black rather than the background green: a shadow tinted with the surface
// colour reads as a halo on a dark theme instead of as depth.
const shadowColor = '#000000';

const ios: Record<Elevation, ViewStyle> = {
  none: {},
  sm: {
    shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  md: {
    shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  lg: {
    shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
  },
};

const android: Record<Elevation, ViewStyle> = {
  none: { elevation: 0 },
  sm: { elevation: 1 },
  md: { elevation: 4 },
  lg: { elevation: 10 },
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
