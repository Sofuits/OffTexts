import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo configuration, as TypeScript so environment variables can be read at
 * build time.
 *
 * Everything on `extra` is bundled into the app and readable by anyone who
 * downloads it. Public endpoints and feature flags only — never a secret.
 * `src/services/config/env.ts` is the typed way to read these back.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Offtexts',
  slug: 'offtexts',
  version: '1.0.0',
  orientation: 'portrait',
  // The palette is dark, so ask the OS for dark chrome. `automatic` would let a
  // phone in light mode render system surfaces pale against a near-black app.
  userInterfaceStyle: 'dark',
  // The OAuth redirect target. Google sends the member back to
  // offtexts://auth/callback, and expo-linking builds that URL from this value,
  // so the two cannot drift apart. Changing it means updating the redirect URL
  // in the Supabase dashboard as well.
  scheme: 'offtexts',
  icon: './assets/icon.png',
  // Matches theme.colors.background, so there is no flash of a different colour
  // between the splash screen and the first frame.
  backgroundColor: '#0B1716',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.offtexts.app',
  },
  android: {
    package: 'com.offtexts.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0B1716',
    },
    predictiveBackGestureEnabled: false,
    // Only a city is ever looked up, which approximate location answers.
    // Blocking precise location keeps the permission prompt honest and means
    // there is no precise position to leak.
    blockedPermissions: ['android.permission.ACCESS_FINE_LOCATION'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  experiments: {
    // Makes Metro honour the `paths` in tsconfig.json, so `@/components`
    // resolves at runtime and not only in the editor.
    tsconfigPaths: true,
  },
  plugins: [
    [
      // The sentences iOS shows when asking. Read by App Review, so they say
      // exactly what each permission is used for and nothing more.
      'expo-image-picker',
      {
        photosPermission: 'Offtexts opens your photos so you can choose pictures for your profile.',
        cameraPermission: 'Offtexts uses the camera so you can take a photo for your profile.',
        // Photos only. Without this the plugin also requests the microphone.
        microphonePermission: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Offtexts uses your location once to fill in your city. Your exact location is never stored or shown.',
        // Never in the background: the city is looked up once, while the
        // member is on the screen that asked.
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          // Pinned rather than inherited. Google Play requires new apps and
          // updates to target Android 16 (API 36) from 31 August 2026; having
          // the number here means it is reviewed when it changes instead of
          // moving silently with an Expo upgrade.
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
      },
    ],
  ],
  extra: {
    // Read back through src/shared/config/env.ts, never process.env directly.
    // Blank Supabase values are the signal to wire in-memory repositories.
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT,
    // Development convenience only. `src/shared/config/env.ts` refuses to honour
    // it when EXPO_PUBLIC_ENVIRONMENT is production, so it cannot ship enabled.
    devSkipAuth: process.env.EXPO_PUBLIC_DEV_SKIP_AUTH,
    // Off unless explicitly enabled. See src/shared/config/env.ts — a Google
    // button with no configured provider fails on tap, which is a worse first
    // impression than not offering it.
    enableGoogleAuth: process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    enableAnalytics: process.env.EXPO_PUBLIC_ENABLE_ANALYTICS,
    // Seconds before "Send a new code" is offered again. Copy it from the
    // Supabase Dashboard; see src/shared/config/env.ts.
    authResendCooldownSeconds: process.env.EXPO_PUBLIC_AUTH_RESEND_COOLDOWN_SECONDS,
    // The Supabase Dashboard's "Password requirements" setting, so the sign-up
    // form lists the same rules the server enforces.
    authPasswordRequirements: process.env.EXPO_PUBLIC_AUTH_PASSWORD_REQUIREMENTS,
    // A one-tap sign-in for reviewing the app while the real sign-in screen is
    // being built by somebody else. These SHIP IN THE BUNDLE and are readable
    // by anyone who downloads it, so they may only ever point at a throwaway
    // test account — see the long comment in src/shared/config/env.ts.
    // src/shared/config/env.ts refuses to honour them when
    // EXPO_PUBLIC_ENVIRONMENT is production, so they cannot ship enabled.
    demoEmail: process.env.EXPO_PUBLIC_DEMO_EMAIL,
    demoPassword: process.env.EXPO_PUBLIC_DEMO_PASSWORD,
    // Links this app to its EAS project, for `eas build` and `eas submit`. EAS
    // cannot write it here itself because this config is TypeScript, not JSON.
    eas: {
      projectId: '49cb0563-3f24-4274-81d2-e9d95a4134ac',
    },
  },
});
