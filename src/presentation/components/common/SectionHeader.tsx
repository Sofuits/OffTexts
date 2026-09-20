import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { useTheme } from '@/presentation/hooks/useTheme';

export type SectionHeaderProps = {
  title: string;
  /** Optional line under the title. */
  subtitle?: string;
  /** Label for the trailing action. Renders nothing when omitted. */
  actionLabel?: string;
  onActionPress?: () => void;
};

/** Title above a group of content, with an optional trailing action. */
export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onActionPress,
}: SectionHeaderProps): React.JSX.Element {
  const theme = useTheme();
  const showAction = Boolean(actionLabel && onActionPress);

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText variant="subheading">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary" style={{ marginTop: theme.spacing[4] }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {showAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={theme.hitSlop}
          onPress={onActionPress}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <AppText variant="label" color="primary">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  text: { flex: 1 },
  pressed: { opacity: 0.6 },
});
