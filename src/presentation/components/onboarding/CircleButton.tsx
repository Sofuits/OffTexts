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
  size?: number;
  /** `primary` fills with brass; `muted` is the disabled-looking inset fill. */
  tone?: 'primary' | 'muted' | 'danger' | 'success';
  style?: ViewStyle;
  testID?: string;
};

/**
 * The round button at the bottom-right of every onboarding step, and the
 * like/pass pair on Today.
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
  size = 60,
  tone = 'primary',
  style,
  testID,
}: CircleButtonProps): React.JSX.Element {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const fills = {
    primary: theme.colors.primary,
    muted: theme.colors.inset,
    danger: theme.colors.danger,
    success: theme.colors.success,
  } as const;

  const background = isDisabled ? theme.colors.inset : fills[tone];
  const foreground = isDisabled ? theme.colors.textDisabled : theme.colors.textOnPrimary;

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
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          borderColor: isDisabled ? theme.colors.border : theme.colors.transparent,
        },
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Ionicons name={icon} size={Math.round(size * 0.42)} color={foreground} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
