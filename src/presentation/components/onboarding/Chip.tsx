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
 * A tappable chip, for picking several things out of many.
 *
 * Distinct from `Badge`, which looks similar and is not interactive. Keeping
 * them separate means a static tag can never accidentally acquire a press
 * handler, and a chip is never rendered without one.
 *
 * Selection is inversion: white with an ink label when off, solid forest with
 * a white label when on. No tick and no ring — the fill is the state. That is
 * a change in lightness, not just hue, so it holds for the one man in twelve
 * who cannot tell green from brown.
 *
 * Radius `md`, not a pill, and 44 tall so it clears the touch-target minimum.
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
          minHeight: theme.sizes.chip,
          paddingVertical: theme.spacing[8],
          paddingHorizontal: theme.spacing[16],
          borderRadius: theme.radii.md,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected ? theme.colors.primary : theme.colors.card,
        },
        pressed && !disabled && styles.pressed,
        disabled && !selected && styles.disabled,
        style,
      ]}
    >
      <AppText variant="title" color={selected ? 'textOnPrimary' : 'textPrimary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

export type ChipGroupProps = {
  children: React.ReactNode;
  /**
   * When set, the selected chips are repeated in a group above the list under
   * this heading ("My selection"), so nothing picked scrolls out of sight.
   * Tapping one there deselects it, exactly as it would in the list.
   */
  selectionLabel?: string;
  style?: ViewStyle;
};

/** Lays chips out in a wrapping row on the spacing scale. */
export function ChipGroup({ children, selectionLabel, style }: ChipGroupProps): React.JSX.Element {
  const theme = useTheme();

  const selected = selectionLabel
    ? React.Children.toArray(children).filter(
        (child): child is React.ReactElement<ChipProps> =>
          React.isValidElement<ChipProps>(child) && child.props.selected === true,
      )
    : [];

  const list = <View style={[styles.group, { gap: theme.spacing[8] }]}>{children}</View>;

  if (!selectionLabel || selected.length === 0) {
    return <View style={style}>{list}</View>;
  }

  return (
    <View style={style}>
      <AppText variant="label">{selectionLabel}</AppText>
      <View
        style={[styles.group, { gap: theme.spacing[8], marginTop: theme.spacing[8] }]}
        testID="chip-selection"
      >
        {/* The same chips again, without their testIDs: a test that finds a
            chip by id should find the one in the list, and only that one. */}
        {selected.map((chip) =>
          React.cloneElement(chip, { key: `selected-${String(chip.key)}`, testID: undefined }),
        )}
      </View>
      <View style={{ marginTop: theme.spacing[20] }}>{list}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center' },
  group: { flexDirection: 'row', flexWrap: 'wrap' },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.4 },
});
