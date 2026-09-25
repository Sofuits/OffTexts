import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/presentation/hooks/useTheme';
import type { SpacingToken } from '@/shared/theme';

export type ScreenContainerProps = {
  children: React.ReactNode;
  /** Wrap the content in a ScrollView. Off for screens that manage their own list. */
  scrollable?: boolean;
  /** Horizontal inset from the spacing scale. */
  padding?: SpacingToken;
  /**
   * Which safe-area edges to inset. A screen inside the tab navigator should
   * not inset the bottom — the tab bar already handles it, and doing both
   * leaves a visible gap above the bar.
   */
  edges?: readonly Edge[];
  style?: ViewStyle;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  /**
   * Move the content up out of the way of the on-screen keyboard. For screens
   * whose text fields sit low enough for the keyboard to cover them — forms.
   * Combine with `scrollable` so the focused field can be scrolled into view.
   */
  avoidKeyboard?: boolean;
  testID?: string;
};

/**
 * The outer shell every screen sits in: background colour, safe-area insets and
 * consistent horizontal padding.
 *
 * Having one of these is what stops each screen inventing its own padding and
 * drifting apart from the others.
 */
export function ScreenContainer({
  children,
  scrollable = true,
  padding = 20,
  edges = ['top'],
  style,
  contentContainerStyle,
  avoidKeyboard = false,
  testID,
}: ScreenContainerProps): React.JSX.Element {
  const theme = useTheme();

  const surface: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.background,
  };

  const inner: ViewStyle = {
    paddingHorizontal: theme.spacing[padding],
  };

  const content = scrollable ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[
        inner,
        { paddingTop: theme.spacing[16], paddingBottom: theme.spacing[40] },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, inner, { paddingTop: theme.spacing[16] }]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[surface, style]} testID={testID}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.fill}
          // The same split as OnboardingStep: iOS pushes the view up; Android's
          // windowSoftInputMode already resizes it, and padding on top of that
          // leaves a keyboard-sized gap.
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
