import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { Button } from '@/presentation/components/buttons/Button';
import { useTheme } from '@/presentation/hooks/useTheme';

export type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** Why it is empty, and what to do about it. Not "No data". */
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
  testID?: string;
};

/**
 * What a screen shows when there is nothing to show.
 *
 * Offtexts is empty by design for most of the day — three people, then nothing
 * until tomorrow — so these are not edge cases, they are the resting state of
 * the app. Each one says why it is empty and when that changes, because
 * "Nothing here" on a screen somebody opened on purpose reads as a fault.
 */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  style,
  testID,
}: EmptyStateProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.panel,
        {
          borderRadius: theme.radii.xl,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
          padding: theme.spacing[32],
        },
        style,
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.badge,
          { backgroundColor: theme.colors.inset, borderRadius: theme.radii.full },
        ]}
      >
        <Ionicons name={icon} size={26} color={theme.colors.primary} />
      </View>

      <AppText variant="title" align="center" style={{ marginTop: theme.spacing[16] }}>
        {title}
      </AppText>
      <AppText
        variant="body"
        color="textSecondary"
        align="center"
        style={{ marginTop: theme.spacing[8] }}
      >
        {body}
      </AppText>

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          variant="outline"
          size="sm"
          onPress={onAction}
          style={{ marginTop: theme.spacing[20] }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  badge: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
