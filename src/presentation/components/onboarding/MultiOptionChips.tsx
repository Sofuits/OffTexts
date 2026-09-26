import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { Chip, ChipGroup } from '@/presentation/components/onboarding/Chip';
import { useTheme } from '@/presentation/hooks/useTheme';

export type MultiOptionChipsProps<T extends string> = {
  label: string;
  /** Adds "Optional" beside the label. */
  optional?: boolean;
  options: readonly T[];
  labels: Record<T, string>;
  values: readonly T[];
  /** The most that may be chosen. The rest dim once it is reached. */
  max: number;
  onChange: (values: T[]) => void;
  style?: ViewStyle;
  testID?: string;
};

/**
 * One question, answered by tapping up to `max` chips.
 *
 * The multi-select sibling of `OptionChips`, for "pick up to three". At the
 * cap the unchosen chips are disabled rather than hidden — the same rule as
 * `InterestPicker` — so the member can still see what they are not choosing.
 */
export function MultiOptionChips<T extends string>({
  label,
  optional = false,
  options,
  labels,
  values,
  max,
  onChange,
  style,
  testID,
}: MultiOptionChipsProps<T>): React.JSX.Element {
  const theme = useTheme();
  const atMax = values.length >= max;

  const toggle = (option: T): void => {
    onChange(
      values.includes(option) ? values.filter((value) => value !== option) : [...values, option],
    );
  };

  return (
    <View style={style} testID={testID}>
      <AppText variant="label" color="textSecondary">
        {label}
        <AppText variant="caption" color={atMax ? 'primary' : 'textDisabled'}>
          {`  ${optional ? 'Optional · ' : ''}up to ${max}`}
        </AppText>
      </AppText>
      <View style={{ marginTop: theme.spacing[8] }}>
        <ChipGroup>
          {options.map((option) => {
            const selected = values.includes(option);
            return (
              <Chip
                key={option}
                label={labels[option]}
                selected={selected}
                disabled={atMax && !selected}
                onPress={() => toggle(option)}
                testID={testID ? `${testID}-${option}` : undefined}
              />
            );
          })}
        </ChipGroup>
      </View>
    </View>
  );
}
