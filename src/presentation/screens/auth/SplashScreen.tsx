import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Logo } from '@/presentation/components/common/Logo';
import { Spacer } from '@/presentation/components/common/Spacer';
import { useTheme } from '@/presentation/hooks/useTheme';

/**
 * Shown while the stored session is being read.
 *
 * This exists because `restoring` is a real state, distinct from signed-out.
 * Reading the session from the keychain takes a moment, and treating that
 * moment as signed-out flashes the sign-in screen at someone who is already
 * signed in. Every app that flickers on launch has skipped this.
 */
export function SplashScreen(): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      testID="screen-splash"
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Logo size={96} />
      <Spacer size={32} />
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
