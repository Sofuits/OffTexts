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
  /** A control inside the field's right edge, such as a show-password button. */
  trailing?: React.ReactNode;
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
  trailing,
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

      <View style={styles.row}>
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
              // Room for the trailing control, so text never runs under it.
              paddingRight: trailing ? 48 : theme.spacing[16],
              borderRadius: theme.radii.md,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor,
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.surface,
            },
          ]}
          {...rest}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>

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
  row: { justifyContent: 'center' },
  // Pinned to the input's height, below the label, and centred in it.
  trailing: { position: 'absolute', right: 4, bottom: 0, height: 48, justifyContent: 'center' },
});
