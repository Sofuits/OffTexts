import React, { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Shown under the field, in danger colour. Also outlines the field. */
  error?: string;
  /** Shown under the field when there is no error. */
  hint?: string;
  containerStyle?: ViewStyle;
};

/**
 * A labelled text input.
 *
 * Included so that forms added later start from a themed, accessible field
 * rather than a bare `TextInput`. No form uses it yet — editing is out of scope
 * for this boilerplate.
 */
export function TextField({
  label,
  error,
  hint,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps): React.JSX.Element {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={containerStyle}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>

      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.placeholder}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          theme.typography.body,
          {
            marginTop: theme.spacing[8],
            minHeight: 48,
            paddingHorizontal: theme.spacing[16],
            borderRadius: theme.radii.md,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor,
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.surface,
          },
        ]}
        {...rest}
      />

      {error || hint ? (
        <AppText
          variant="caption"
          color={error ? 'danger' : 'textSecondary'}
          style={{ marginTop: theme.spacing[4] }}
        >
          {error ?? hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { width: '100%' },
});
