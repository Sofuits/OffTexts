import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';

export type ChoiceRowProps = {
  label: string;
  /** A line under the label. Used where the choice is not self-explanatory. */
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** `single` draws a radio, `multiple` a checkbox. */
  mode?: 'single' | 'multiple';
  /** An icon on the left, for lists short enough that icons help rather than clutter. */
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
};

/**
 * One option in a list you pick from.
 *
 * The whole row is the target, not just the control at the end of it. A 20dp
 * radio button is below every touch-target guideline there is, and a list where
 * the label is not tappable is the single most common reason a choice screen
 * feels unresponsive.
 *
 * `accessibilityRole` changes with `mode` so the selected state is announced
 * the way the platform expects — "selected" for a radio, "checked" for a
 * checkbox. Getting this wrong is invisible until somebody uses the app without
 * looking at it.
 */
export function ChoiceRow({
  label,
  description,
  selected,
  onPress,
  mode = 'single',
  icon,
  disabled = false,
  style,
  testID,
}: ChoiceRowProps): React.JSX.Element {
  const theme = useTheme();

  const control =
    mode === 'single'
      ? selected
        ? 'ellipse'
        : 'ellipse-outline'
      : selected
        ? 'checkbox'
        : 'square-outline';

  return (
    <Pressable
      accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'}
      accessibilityState={{ selected, checked: selected, disabled }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: theme.minTouchTarget + 12,
          paddingVertical: theme.spacing[12],
          paddingHorizontal: theme.spacing[16],
          gap: theme.spacing[12],
          borderRadius: theme.radii.lg,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected ? theme.colors.inset : theme.colors.card,
        },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={22}
          color={selected ? theme.colors.primary : theme.colors.textSecondary}
        />
      ) : null}

      <View style={styles.text}>
        <AppText variant={selected ? 'bodyStrong' : 'body'}>{label}</AppText>
        {description ? (
          <AppText variant="caption" color="textSecondary" style={{ marginTop: theme.spacing[2] }}>
            {description}
          </AppText>
        ) : null}
      </View>

      <Ionicons
        name={control}
        size={22}
        color={selected ? theme.colors.primary : theme.colors.textDisabled}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
