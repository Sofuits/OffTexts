import React from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
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

  return (
    <SafeAreaView edges={edges} style={[surface, style]} testID={testID}>
      {scrollable ? (
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
