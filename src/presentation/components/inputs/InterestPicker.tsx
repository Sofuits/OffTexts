import React, { useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { Chip, ChipGroup } from '@/presentation/components/onboarding/Chip';
import { CircleButton } from '@/presentation/components/onboarding/CircleButton';
import { Spacer } from '@/presentation/components/common/Spacer';
import { TextField } from '@/presentation/components/inputs/TextField';
import { useTheme } from '@/presentation/hooks/useTheme';
import { SUGGESTED_INTERESTS } from '@/shared/constants/app';

export type InterestPickerProps = {
  selected: string[];
  onChange: (interests: string[]) => void;
  min: number;
  max: number;
  /** What to offer as chips. Defaults to the interests list. */
  suggestions?: readonly string[];
  /** Label and placeholder for the "type your own" field. */
  customLabel?: string;
  customPlaceholder?: string;
  /** Prefix for test ids, so two pickers on one screen stay distinguishable. */
  testIDPrefix?: string;
  style?: ViewStyle;
};

/**
 * Choosing interests, in the two places that ask for them.
 *
 * Written once because the onboarding step and the profile editor must agree
 * about more than layout: the de-duplication is case-insensitive, the cap
 * disables the unchosen chips rather than hiding them, and an interest typed by
 * hand sorts to the front so it does not vanish into a list of twenty-four
 * suggestions. Two copies of that would disagree within a month.
 *
 * The suggestions are a prompt, not a vocabulary — anything may be typed. A
 * blank text box gets "music, travel, food" from everybody, which tells the
 * next person nothing; a list to tap produces both more answers and more
 * specific ones.
 */
export function InterestPicker({
  selected,
  onChange,
  min,
  max,
  suggestions = SUGGESTED_INTERESTS,
  customLabel = 'Something else',
  customPlaceholder = 'Kathak, Formula 1, birdwatching…',
  testIDPrefix = 'interest',
  style,
}: InterestPickerProps): React.JSX.Element {
  const theme = useTheme();
  const [custom, setCustom] = useState('');
  const atMax = selected.length >= max;

  const toggle = (interest: string): void => {
    onChange(
      selected.includes(interest)
        ? selected.filter((value) => value !== interest)
        : [...selected, interest],
    );
  };

  const addCustom = (): void => {
    const value = custom.trim();
    if (!value || atMax) return;

    // Case-insensitive, so "coffee" typed by hand does not sit beside the
    // "Coffee" chip as a second, different interest.
    if (selected.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      setCustom('');
      return;
    }

    onChange([...selected, value]);
    setCustom('');
  };

  // Chosen-but-not-suggested first, so an interest that was typed rather than
  // tapped stays where the member can see and remove it.
  const typed = selected.filter((interest) => !suggestions.some((s) => s === interest));

  return (
    <View style={style}>
      <AppText
        variant="label"
        color={atMax ? 'primary' : 'textSecondary'}
        testID={`${testIDPrefix}s-count`}
      >
        {min > 0
          ? `${selected.length} of ${max} chosen · pick at least ${min}`
          : `${selected.length} of ${max} chosen`}
      </AppText>
      <Spacer size={12} />

      <ChipGroup>
        {[...typed, ...suggestions].map((interest) => {
          const isOn = selected.includes(interest);
          return (
            <Chip
              key={interest}
              label={interest}
              selected={isOn}
              // Disabled rather than removed: the member can still see what
              // they are not choosing, which is what makes the cap legible.
              disabled={atMax && !isOn}
              onPress={() => toggle(interest)}
              testID={`chip-${testIDPrefix}-${interest}`}
            />
          );
        })}
      </ChipGroup>

      <Spacer size={24} />
      <View style={[styles.addRow, { gap: theme.spacing[12] }]}>
        <View style={styles.grow}>
          <TextField
            label={customLabel}
            value={custom}
            onChangeText={setCustom}
            onSubmitEditing={addCustom}
            placeholder={customPlaceholder}
            autoCapitalize="sentences"
            maxLength={40}
            returnKeyType="done"
            editable={!atMax}
            testID={`input-custom-${testIDPrefix}`}
          />
        </View>
        <CircleButton
          icon="add"
          accessibilityLabel={`Add this ${testIDPrefix}`}
          onPress={addCustom}
          disabled={atMax || custom.trim().length === 0}
          size={48}
          style={{ marginBottom: theme.spacing[2] }}
          testID={`button-add-${testIDPrefix}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row', alignItems: 'flex-end' },
  grow: { flex: 1 },
});
