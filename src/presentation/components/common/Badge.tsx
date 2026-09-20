import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { ColorToken } from '@/shared/theme';

export type BadgeProps = {
  label: string;
  /** Which token tints the border and the text. */
  tone?: Extract<ColorToken, 'primary' | 'success' | 'warning' | 'danger' | 'textSecondary'>;
  style?: ViewStyle;
};

/** A small outlined pill: a status, a tag, an interest. */
export function Badge({ label, tone = 'textSecondary', style }: BadgeProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.pill,
        {
          borderRadius: theme.radii.full,
          borderColor: theme.colors[tone],
          paddingVertical: theme.spacing[4],
          paddingHorizontal: theme.spacing[12],
        },
        style,
      ]}
    >
      <AppText variant="caption" color={tone}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: StyleSheet.hairlineWidth * 2, alignSelf: 'flex-start' },
});
