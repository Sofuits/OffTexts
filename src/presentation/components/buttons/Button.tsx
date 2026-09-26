import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the width of the parent. */
  fullWidth?: boolean;
  style?: ViewStyle;
};

/**
 * The app's only button.
 *
 * Variants cover the cases screens actually need, so a feature never styles a
 * `Pressable` itself. Sizes keep every button on the spacing scale and at or
 * above the minimum touch target.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  ...rest
}: ButtonProps): React.JSX.Element {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  // Greyed out only when genuinely unavailable. A button that is loading keeps
  // its colour and shows the spinner — it is busy, not off.
  const looksDisabled = disabled && !loading;
  const isFilled = variant === 'primary' || variant === 'secondary' || variant === 'danger';

  const { container, textColor } = useMemo(() => {
    const byVariant: Record<
      ButtonVariant,
      { container: ViewStyle; textColor: Parameters<typeof AppText>[0]['color'] }
    > = {
      primary: {
        container: { backgroundColor: theme.colors.primary },
        textColor: 'textOnPrimary',
      },
      secondary: {
        container: { backgroundColor: theme.colors.secondary },
        textColor: 'textOnPrimary',
      },
      outline: {
        container: {
          backgroundColor: theme.colors.transparent,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: theme.colors.border,
        },
        textColor: 'textPrimary',
      },
      ghost: {
        container: { backgroundColor: theme.colors.transparent },
        textColor: 'primary',
      },
      danger: {
        container: { backgroundColor: theme.colors.danger },
        textColor: 'textOnPrimary',
      },
    };

    const bySize: Record<ButtonSize, ViewStyle> = {
      sm: {
        minHeight: theme.minTouchTarget,
        paddingVertical: theme.spacing[8],
        paddingHorizontal: theme.spacing[16],
        borderRadius: theme.radii.md,
      },
      md: {
        minHeight: 48,
        paddingVertical: theme.spacing[12],
        paddingHorizontal: theme.spacing[20],
        borderRadius: theme.radii.lg,
      },
      lg: {
        minHeight: 56,
        paddingVertical: theme.spacing[16],
        paddingHorizontal: theme.spacing[24],
        borderRadius: theme.radii.lg,
      },
    };

    return {
      container: { ...byVariant[variant].container, ...bySize[size] },
      textColor: byVariant[variant].textColor,
    };
  }, [theme, variant, size]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        container,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        // A flat `muted` fill rather than fading the colour: a half-transparent
        // forest button reads as a weaker version of the action, not as "not yet".
        looksDisabled && isFilled && { backgroundColor: theme.colors.muted },
        style,
      ]}
      {...rest}
    >
      {/* The label stays mounted while loading so the button keeps its width. */}
      <View style={styles.content}>
        <AppText
          variant="button"
          color={looksDisabled ? 'textDisabled' : textColor}
          style={loading ? styles.hidden : undefined}
        >
          {label}
        </AppText>
        {loading ? (
          <ActivityIndicator
            style={StyleSheet.absoluteFill}
            color={
              variant === 'outline' || variant === 'ghost'
                ? theme.colors.primary
                : theme.colors.textOnPrimary
            }
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  fullWidth: { alignSelf: 'stretch', width: '100%' },
  content: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  hidden: { opacity: 0 },
});
