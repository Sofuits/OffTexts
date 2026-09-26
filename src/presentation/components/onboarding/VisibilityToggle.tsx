import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Switch, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';

export type VisibilityToggleProps = {
  /** Whether the answer appears on the profile others see. */
  shown: boolean;
  onChange: (shown: boolean) => void;
  /** What is being shown or hidden, e.g. "your company". */
  subject: string;
  style?: ViewStyle;
  testID?: string;
};

/**
 * "Show this on my profile", directly under the answer it controls.
 *
 * Beside the field rather than on a settings screen, because that is the only
 * moment anybody thinks about it. The line underneath says what happens either
 * way, in words: a switch alone says "on" or "off" without saying on for whom.
 */
export function VisibilityToggle({
  shown,
  onChange,
  subject,
  style,
  testID,
}: VisibilityToggleProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={[styles.row, { gap: theme.spacing[12], marginTop: theme.spacing[8] }, style]}>
      <Ionicons
        name={shown ? 'eye-outline' : 'eye-off-outline'}
        size={18}
        color={theme.colors.textSecondary}
      />
      <AppText variant="caption" color="textSecondary" style={styles.grow}>
        {shown ? `Showing ${subject} on your profile` : `Only you can see ${subject}`}
      </AppText>
      <Switch
        value={shown}
        onValueChange={onChange}
        accessibilityLabel={`Show ${subject} on your profile`}
        trackColor={{ true: theme.colors.primary, false: theme.colors.inset }}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});
