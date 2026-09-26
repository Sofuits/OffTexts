import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /**
   * Dims the chip and blocks the press. Used when a maximum has been reached —
   * the chip stays visible so the member can see what they are not choosing.
   */
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
};

/**
 * A tappable pill, for picking several things out of many.
 *
 * Distinct from `Badge`, which looks similar and is not interactive. Keeping
 * them separate means a static tag can never accidentally acquire a press
 * handler, and a chip is never rendered without one.
 *
 * Selection is shown by fill and by a tick, not by colour alone — roughly one
 * man in twelve cannot reliably tell the brass fill from the surface, and the
 * tick costs nothing.
 */
export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
  style,
  testID,
}: ChipProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        {
          minHeight: theme.minTouchTarget - 8,
          paddingVertical: theme.spacing[8],
          paddingHorizontal: theme.spacing[16],
          gap: theme.spacing[8],
          borderRadius: theme.radii.full,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected ? theme.colors.inset : theme.colors.transparent,
        },
        pressed && !disabled && styles.pressed,
        disabled && !selected && styles.disabled,
        style,
      ]}
    >
      {selected ? <Ionicons name="checkmark" size={16} color={theme.colors.primary} /> : null}
      <AppText variant="label" color={selected ? 'primary' : 'textSecondary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Lays chips out in a wrapping row on the spacing scale. */
export function ChipGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}): React.JSX.Element {
  const theme = useTheme();
  return <View style={[styles.group, { gap: theme.spacing[8] }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center' },
  group: { flexDirection: 'row', flexWrap: 'wrap' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});
