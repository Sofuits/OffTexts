import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { Chip, ChipGroup } from '@/presentation/components/onboarding/Chip';
import { useTheme } from '@/presentation/hooks/useTheme';

export type OptionChipsProps<T extends string> = {
  label: string;
  /** Adds "Optional" beside the label, so required and optional look different. */
  optional?: boolean;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | null;
  /** Called with null when the chosen chip is tapped again. */
  onChange: (value: T | null) => void;
  style?: ViewStyle;
  testID?: string;
};

/**
 * One question, answered by tapping one chip.
 *
 * For the short multiple-choice questions — smoking, diet, work mode — where a
 * list of full-width rows would turn six questions into six screens. Chips fit
 * a question in two lines, so a whole section fits on one step.
 *
 * Tapping the chosen chip clears it. Every question this is used for is
 * optional, and an optional answer that cannot be taken back is not optional.
 */
export function OptionChips<T extends string>({
  label,
  optional = false,
  options,
  labels,
  value,
  onChange,
  style,
  testID,
}: OptionChipsProps<T>): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={style} testID={testID}>
      <AppText variant="label" color="textSecondary">
        {label}
        {optional ? (
          <AppText variant="caption" color="textDisabled">
            {'  Optional'}
          </AppText>
        ) : null}
      </AppText>
      <View style={{ marginTop: theme.spacing[8] }}>
        <ChipGroup>
          {options.map((option) => (
            <Chip
              key={option}
              label={labels[option]}
              selected={value === option}
              onPress={() => onChange(value === option ? null : option)}
              testID={testID ? `${testID}-${option}` : undefined}
            />
          ))}
        </ChipGroup>
      </View>
    </View>
  );
}
