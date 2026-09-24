import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { Logo } from '@/presentation/components/common/Logo';
import { useTheme } from '@/presentation/hooks/useTheme';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Show the Offtexts mark on the left. Used on the three tab screens. */
  showLogo?: boolean;
  /** Anything to place on the right: a button, a badge. */
  right?: React.ReactNode;
};

/**
 * The top of a tab screen.
 *
 * The tab screens have no navigation bar — the header is part of the content,
 * which keeps the brand visible and gives each screen a little more vertical
 * room than a stock header would.
 */
export function ScreenHeader({
  title,
  subtitle,
  showLogo = false,
  right,
}: ScreenHeaderProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {/* Nudged down so the mark's optical centre sits on the title's cap
          height rather than on the top of its line box. */}
      {showLogo ? (
        <Logo size={40} style={{ marginRight: theme.spacing[12], marginTop: theme.spacing[2] }} />
      ) : null}

      <View style={styles.text}>
        <AppText variant="heading">{title}</AppText>
        {subtitle ? (
          <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing[4] }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {right ? <View style={{ marginLeft: theme.spacing[12] }}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // `flex-start`, not `center`. Centring looks right next to a one-line
  // subtitle and wrong next to a two-line one — the mark drifts down beside the
  // subtitle instead of sitting with the title. Screens have both.
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  text: { flex: 1 },
});
