import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/presentation/hooks/useTheme';

export type ProgressDotsProps = {
  /** 1-based. */
  current: number;
  total: number;
  style?: ViewStyle;
  testID?: string;
};

/**
 * How far through a flow you are, as a row of short bars.
 *
 * A bar per step rather than a percentage, because the useful question is not
 * "how far along am I" but "how many more of these are there". A 60% bar does
 * not answer that; nine dashes with four filled does.
 *
 * Each bar is 15×4: forest when done, `muted` when not, and the current one
 * half filled — you are on it, not past it.
 *
 * Above sixteen steps the bars stop fitting across a phone, so it collapses to
 * a single track with a filled portion. That is a real limit of the pattern
 * rather than something to design around. Onboarding is twelve or thirteen
 * steps depending on the purpose, and both must get the same bars.
 */
export function ProgressDots({
  current,
  total,
  style,
  testID,
}: ProgressDotsProps): React.JSX.Element {
  const theme = useTheme();
  const safeTotal = Math.max(total, 1);
  const done = Math.min(Math.max(current, 0), safeTotal);

  if (safeTotal > MAX_BARS) {
    return (
      <View
        style={[styles.row, style]}
        testID={testID}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: safeTotal, now: done }}
      >
        <View style={[styles.track, { backgroundColor: theme.colors.muted }]}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: theme.colors.primary,
                width: `${(done / safeTotal) * 100}%`,
              },
            ]}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.row, { gap: theme.spacing[4] }, style]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${done} of ${safeTotal}`}
      accessibilityValue={{ min: 0, max: safeTotal, now: done }}
    >
      {Array.from({ length: safeTotal }, (_, index) => (
        <View key={index} style={[styles.dash, { backgroundColor: theme.colors.muted }]}>
          {index < done ? (
            <View
              style={[
                styles.dashFill,
                {
                  backgroundColor: theme.colors.primary,
                  width: index === done - 1 ? '50%' : '100%',
                },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const MAX_BARS = 16;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
  dash: { width: 15, height: 4, borderRadius: 2, overflow: 'hidden' },
  dashFill: { height: 4 },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
