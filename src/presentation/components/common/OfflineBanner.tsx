import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useConnectivity } from '@/presentation/hooks/useConnectivity';
import { useTheme } from '@/presentation/hooks/useTheme';

/**
 * A quiet strip shown while the device cannot reach the internet.
 *
 * Deliberately not a modal or a toast. The repositories fall back to cached
 * data, so the app still works — the member needs to know what they are looking
 * at might be stale, not to be interrupted.
 */
export function OfflineBanner(): React.JSX.Element | null {
  const theme = useTheme();
  const { isOnline } = useConnectivity();

  if (isOnline) return null;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.inset,
          borderBottomColor: theme.colors.border,
          paddingVertical: theme.spacing[8],
          paddingHorizontal: theme.spacing[16],
        },
      ]}
    >
      <AppText variant="caption" color="warning" align="center">
        You are offline. Showing the last saved version.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%', borderBottomWidth: StyleSheet.hairlineWidth },
});
