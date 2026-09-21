import React, { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { theme } from '@/shared/theme';

type State = { error: Error | null };

/**
 * Catches a render error anywhere below it and shows the message instead of
 * letting the app die.
 *
 * Without this, one bad line in one screen unmounts the whole tree and the user
 * gets a blank screen with nothing to report. With it, the error is on screen
 * and can be read out — which is how the `Intl.RelativeTimeFormat` crash on the
 * Meets tab would have been diagnosed in seconds rather than by guesswork.
 *
 * This has to be a class: `componentDidCatch` has no hook equivalent.
 *
 * It reads `theme` directly rather than through `useTheme()`, because a class
 * cannot use hooks and because the thing that just failed might be the provider.
 */
export class ErrorBoundary extends Component<PropsWithChildren, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Replace with Sentry (or similar) when error reporting is added.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  override render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppText variant="subheading">Something broke</AppText>
          <AppText variant="body" color="textSecondary" style={styles.gap}>
            This screen hit an error and stopped rendering. The message below is what to send to
            whoever is fixing it.
          </AppText>
          <View style={styles.box}>
            <AppText variant="caption" color="danger">
              {error.message}
            </AppText>
          </View>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing[24] },
  gap: { marginTop: theme.spacing[8] },
  box: {
    marginTop: theme.spacing[16],
    padding: theme.spacing[16],
    borderRadius: theme.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.inset,
  },
});
