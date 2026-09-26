import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { CircleButton } from '@/presentation/components/onboarding/CircleButton';
import { useTheme } from '@/presentation/hooks/useTheme';

export type AgeRangeFieldProps = {
  min: number;
  max: number;
  /** The widest range allowed. */
  floor: number;
  ceiling: number;
  onChange: (range: { min: number; max: number }) => void;
  style?: ViewStyle;
};

/**
 * An age range as two steppers.
 *
 * Not a two-thumb slider: there is no slider in the component library, and a
 * slider's thumbs are a poor touch target for one-year precision anyway. Two
 * rows of − and + cannot produce an inverted range — each side stops where the
 * other one is.
 */
export function AgeRangeField({
  min,
  max,
  floor,
  ceiling,
  onChange,
  style,
}: AgeRangeFieldProps): React.JSX.Element {
  const theme = useTheme();

  const row = (
    label: string,
    value: number,
    lower: number,
    upper: number,
    set: (value: number) => void,
    id: string,
  ): React.JSX.Element => (
    <View style={[styles.row, { gap: theme.spacing[16] }]}>
      <AppText variant="bodyStrong" style={styles.grow}>
        {label}
      </AppText>
      <CircleButton
        icon="remove"
        size={40}
        tone="muted"
        accessibilityLabel={`${label}: one year younger`}
        onPress={() => set(value - 1)}
        disabled={value <= lower}
        testID={`button-${id}-down`}
      />
      <AppText variant="heading" align="center" style={styles.value} testID={`value-${id}`}>
        {String(value)}
      </AppText>
      <CircleButton
        icon="add"
        size={40}
        tone="muted"
        accessibilityLabel={`${label}: one year older`}
        onPress={() => set(value + 1)}
        disabled={value >= upper}
        testID={`button-${id}-up`}
      />
    </View>
  );

  return (
    <View style={[{ gap: theme.spacing[20] }, style]}>
      {row('Youngest', min, floor, max, (value) => onChange({ min: value, max }), 'age-min')}
      {row('Oldest', max, min, ceiling, (value) => onChange({ min, max: value }), 'age-max')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  value: { minWidth: 40 },
});
