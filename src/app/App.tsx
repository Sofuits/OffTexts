// One entry point per weight. The package index requires every weight and
// italic of both families — about 2MB of fonts the app never draws.
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Fraunces_800ExtraBold } from '@expo-google-fonts/fraunces/800ExtraBold';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

import { AppProviders } from '@/app/providers';
import { RootNavigator } from '@/app/navigation';

// Keep the native launch screen up until the fonts are in. Rendering first and
// swapping the face afterwards makes every line of text visibly reflow.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (a fast refresh, or web, where there is no native splash).
});

/**
 * App root.
 *
 * Three lines, because everything else has a home: providers in
 * `app/providers`, routing in `app/navigation`, dependencies in `app/di`.
 *
 * The keys here are the names `theme.fontFamilies` refers to, so the two must
 * stay in step.
 *
 * The status bar is `dark` because the palette is light — the word describes
 * the icons, not the background.
 */
export default function App(): React.JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Fraunces_800ExtraBold,
  });
  // A font that fails to load is not a reason to trap someone on the splash
  // screen. The system font is a worse app, not a broken one.
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <AppProviders>
      <StatusBar style="dark" />
      <RootNavigator />
    </AppProviders>
  );
}
