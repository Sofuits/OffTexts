import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';

export type ChoiceRowPosition = 'first' | 'middle' | 'last' | 'only';

export type ChoiceRowProps = {
  label: string;
  /** A line under the label. Used where the choice is not self-explanatory. */
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** `single` draws a radio, `multiple` a checkbox. */
  mode?: 'single' | 'multiple';
  /**
   * Where the row sits in a `multiple` group, so the shared card rounds its
   * ends and draws dividers only between rows. Ignored for `single`, where
   * every option is its own card.
   */
  position?: ChoiceRowPosition;
  /** An icon after the control, for lists short enough that icons help rather than clutter. */
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
};

/**
 * One option in a list you pick from.
 *
 * The whole row is the target, not just the control. A 22dp radio is below
 * every touch-target guideline there is, and a list where the label is not
 * tappable is the single most common reason a choice screen feels
 * unresponsive.
 *
 * SINGLE AND MULTIPLE LOOK DIFFERENT, ON PURPOSE
 * `single` is one white card per option with gaps between them and a round
 * control. `multiple` is rows inside one shared white card with hairline
 * dividers and a square control — the caller stacks them with no gap and says
 * which is `first`, `middle` and `last`. The shape tells you whether picking
 * this one un-picks the others before you try it. Both keep the control on the
 * left, where the eye starts.
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
  position = 'only',
  icon,
  disabled = false,
  style,
  testID,
}: ChoiceRowProps): React.JSX.Element {
  const theme = useTheme();
  const hairline = StyleSheet.hairlineWidth * 2;

  const shape: ViewStyle =
    mode === 'single'
      ? {
          borderRadius: theme.radii.lg,
          borderWidth: hairline,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        }
      : {
          borderColor: theme.colors.border,
          borderLeftWidth: hairline,
          borderRightWidth: hairline,
          // The first row's top edge is the card's; every other row's top edge
          // is the divider under the row above, which draws no bottom edge.
          borderTopWidth: hairline,
          borderBottomWidth: position === 'last' || position === 'only' ? hairline : 0,
          ...(position === 'first' || position === 'only'
            ? { borderTopLeftRadius: theme.radii.lg, borderTopRightRadius: theme.radii.lg }
            : {}),
          ...(position === 'last' || position === 'only'
            ? { borderBottomLeftRadius: theme.radii.lg, borderBottomRightRadius: theme.radii.lg }
            : {}),
        };

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
          minHeight: theme.sizes.optionRow,
          paddingVertical: theme.spacing[12],
          paddingHorizontal: theme.spacing[16],
          gap: theme.spacing[12],
          backgroundColor: theme.colors.card,
        },
        shape,
        pressed && !disabled && { backgroundColor: theme.colors.background },
        disabled && styles.disabled,
        style,
      ]}
    >
      <SelectionControl mode={mode} selected={selected} />

      {icon ? (
        <Ionicons
          name={icon}
          size={22}
          color={selected ? theme.colors.primary : theme.colors.textSecondary}
        />
      ) : null}

      <View style={styles.text}>
        <AppText variant="title">{label}</AppText>
        {description ? (
          <AppText variant="caption" color="textSecondary" style={{ marginTop: theme.spacing[2] }}>
            {description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const CONTROL = 22;

/**
 * The radio or the checkbox, drawn rather than taken from the icon font, so the
 * selected state can be an inverted fill — forest with white inside — like
 * every other selection in the app.
 *
 * Exported for the few places that need the same checkbox outside a row — the
 * shared-dates table — so there is one drawing of it, not two.
 *
 * The checkbox radius is deliberately small (6, not the `sm` token). At 22dp,
 * `sm` would round the square into a circle and erase the single/multiple
 * difference the shapes exist to show.
 */
export function SelectionControl({
  mode,
  selected,
}: {
  mode: 'single' | 'multiple';
  selected: boolean;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.control,
        {
          borderRadius: mode === 'single' ? CONTROL / 2 : 6,
          borderColor: selected ? theme.colors.primary : theme.colors.textDisabled,
          backgroundColor: selected ? theme.colors.primary : theme.colors.card,
        },
      ]}
    >
      {selected ? (
        mode === 'single' ? (
          <View style={[styles.dot, { backgroundColor: theme.colors.textOnPrimary }]} />
        ) : (
          <Ionicons name="checkmark" size={16} color={theme.colors.textOnPrimary} />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
  control: {
    width: CONTROL,
    height: CONTROL,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  disabled: { opacity: 0.45 },
});
