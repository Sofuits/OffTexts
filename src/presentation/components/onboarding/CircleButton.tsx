import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { useTheme } from '@/presentation/hooks/useTheme';

export type CircleButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Spoken by a screen reader. The icon says nothing on its own. */
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Defaults to 48, the next button Breeze measures at. */
  size?: number;
  /** `primary` fills with forest; `muted` is a white button with a ring, for the quieter of a pair. */
  tone?: 'primary' | 'muted' | 'danger' | 'success';
  style?: ViewStyle;
  testID?: string;
};

/**
 * The square-ish button at the bottom-right of every onboarding step, and the
 * like/pass pair on Today.
 *
 * Despite the name it is a squircle (radius `lg`), the same shape family as
 * every other control; the name stays so no screen has to change to get it.
 *
 * It stays on screen and visibly disabled rather than disappearing until the
 * answer is valid. A control that vanishes makes people wonder what they did
 * wrong; a grey one that is plainly the next step makes them look back at the
 * field.
 *
 * `disabled` is passed to `accessibilityState` as well as to `Pressable`,
 * because VoiceOver and TalkBack read that state aloud — without it a blind
 * member taps a button that silently does nothing.
 */
export function CircleButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
  loading = false,
  size,
  tone = 'primary',
  style,
  testID,
}: CircleButtonProps): React.JSX.Element {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const side = size ?? theme.sizes.nextButton;

  // Each tone owns its foreground. Reusing `textOnPrimary` for every fill is
  // what once drew a white glyph on the white `muted` button.
  const tones = {
    primary: { fill: theme.colors.primary, glyph: theme.colors.textOnPrimary, ring: undefined },
    muted: {
      fill: theme.colors.card,
      glyph: theme.colors.textPrimary,
      ring: theme.colors.borderStrong,
    },
    danger: { fill: theme.colors.danger, glyph: theme.colors.textOnPrimary, ring: undefined },
    success: { fill: theme.colors.success, glyph: theme.colors.textOnPrimary, ring: undefined },
  } as const;

  // Disabled is a flat `muted` fill with no ring and no shadow: it has to read
  // as "not yet", not as a quieter version of the same button.
  const { fill, glyph, ring } = isDisabled
    ? { fill: theme.colors.muted, glyph: theme.colors.textDisabled, ring: undefined }
    : tones[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.circle,
        {
          width: side,
          height: side,
          borderRadius: theme.radii.lg,
          backgroundColor: fill,
          borderColor: ring ?? theme.colors.transparent,
        },
        !isDisabled && theme.shadows.sm,
        pressed && !isDisabled && styles.pressed,
        pressed &&
          !isDisabled &&
          tone === 'primary' && {
            backgroundColor: theme.colors.primaryPressed,
          },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={glyph} />
      ) : (
        <Ionicons name={icon} size={Math.round(side * 0.42)} color={glyph} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  pressed: { transform: [{ scale: 0.96 }] },
});
