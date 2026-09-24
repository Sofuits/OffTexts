import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { AppProviders } from '@/app/providers';
import { RootNavigator } from '@/app/navigation';

/**
 * App root.
 *
 * Three lines, because everything else has a home: providers in
 * `app/providers`, routing in `app/navigation`, dependencies in `app/di`.
 *
 * The status bar is `dark` because the palette is light — the word describes
 * the icons, not the background.
 */
export default function App(): React.JSX.Element {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <RootNavigator />
    </AppProviders>
  );
}
