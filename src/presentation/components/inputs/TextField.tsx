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
 * White on cream, radius `lg`, 52 tall, with a hairline edge. Focus is shown
 * the way Breeze shows it: a solid band about 5dp deep appears under the
 * field's bottom edge, as if the field had lifted. The border stays a hairline
 * on focus, so the band is the only signal. Room for the band is reserved
 * whether it is showing or not, so focusing a field never moves the form.
 *
 * An error is a 2dp danger border plus the message underneath, never colour
 * alone.
 */
export function TextField({
  label,
  error,
  hint,
  containerStyle,
  trailing,
  onFocus,
  onBlur,
  multiline,
  ...rest
}: TextFieldProps): React.JSX.Element {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const band = theme.sizes.fieldFocusBand;

  return (
    <View style={containerStyle}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>

      <View style={{ marginTop: theme.spacing[8], paddingBottom: band }}>
        {focused ? (
          <View
            pointerEvents="none"
            style={[
              styles.band,
              { top: band, borderRadius: theme.radii.lg, backgroundColor: theme.colors.border },
            ]}
          />
        ) : null}

        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={theme.colors.placeholder}
          multiline={multiline}
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
              minHeight: theme.sizes.field,
              paddingHorizontal: theme.spacing[16],
              // Room for the trailing control, so text never runs under it.
              paddingRight: trailing ? theme.sizes.field : theme.spacing[16],
              borderRadius: theme.radii.lg,
              borderWidth: error ? 2 : StyleSheet.hairlineWidth * 2,
              borderColor: error ? theme.colors.danger : theme.colors.border,
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.inset,
            },
            multiline && [styles.multiline, { paddingVertical: theme.spacing[12] }],
          ]}
          {...rest}
        />
        {/* Over the input's right edge: the same height as the field (not the
            band beneath it), and above the input so it can be pressed. */}
        {trailing ? (
          <View style={[styles.trailing, { height: theme.sizes.field }]}>{trailing}</View>
        ) : null}
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
  // Above the band on every platform. Native paints siblings in order, but on
  // the web an absolutely positioned band paints over a static input.
  input: { width: '100%', position: 'relative', zIndex: 1 },
  // Android centres multiline text vertically unless told otherwise.
  multiline: { textAlignVertical: 'top' },
  band: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  trailing: { position: 'absolute', top: 0, right: 4, justifyContent: 'center', zIndex: 2 },
});
