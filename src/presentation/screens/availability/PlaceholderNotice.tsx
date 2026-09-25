import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, IconTile } from '@/presentation/components';
import { useTheme } from '@/presentation/hooks/useTheme';

/**
 * Says, on screen, that the other person's dates are made up.
 *
 * The date-sharing screens look finished and are not: there is nowhere yet to
 * store one member's dates where the other can read them, so the second
 * column is invented on this phone (`InMemoryDateSharingRepository`). A
 * provisional screen that looks provisional is honest; one that looks like a
 * working feature is a bug report waiting to be filed by whoever demos it.
 *
 * The whole flow is only reachable outside production (see the entry on the
 * Meets tab), so this never reaches a member.
 */
export function PlaceholderNotice({ name }: { name?: string }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.cardTinted,
          borderColor: theme.colors.accent,
          borderRadius: theme.radii.lg,
          padding: theme.spacing[12],
          gap: theme.spacing[12],
        },
      ]}
      accessibilityRole="alert"
      testID="placeholder-notice"
    >
      <IconTile name="construct-outline" variant="plain" size={40} />
      <View style={styles.grow}>
        <AppText variant="label">Preview — not real yet</AppText>
        <AppText variant="caption" style={{ marginTop: theme.spacing[2] }}>
          {`${name ? `${name}’s dates are` : 'The other person’s dates are'} made up on this phone. Sharing dates between two people is not built yet.`}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  grow: { flex: 1 },
});
