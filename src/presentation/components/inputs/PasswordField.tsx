import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';

import { TextField, type TextFieldProps } from '@/presentation/components/inputs/TextField';
import { useTheme } from '@/presentation/hooks/useTheme';

export type PasswordFieldProps = Omit<
  TextFieldProps,
  'secureTextEntry' | 'trailing' | 'value' | 'onChangeText'
> & {
  value: string;
  onChangeText: (text: string) => void;
};

/**
 * A password input with a show/hide button, that edits one character at a time.
 *
 * WHY THE KEY HANDLING
 * iOS clears a hidden password field entirely when you leave it, come back and
 * press delete — or replaces the whole thing with the first key you type. It
 * is the platform's behaviour for secure fields and a member reads it as the
 * app eating their password. React Native reports the key before the text
 * change, so when a single Backspace arrives as "everything is gone", or a
 * single character arrives as "the field is now just that character", this
 * applies the one-character edit the member actually made.
 *
 * A paste or a password manager's fill arrives with no key press, so it is
 * passed through untouched. Android does not do this and is left alone.
 */
export function PasswordField({
  value,
  onChangeText,
  onKeyPress,
  ...rest
}: PasswordFieldProps): React.JSX.Element {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const lastKey = useRef<string | null>(null);

  const handleKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      lastKey.current = event.nativeEvent.key;
      onKeyPress?.(event);
    },
    [onKeyPress],
  );

  const handleChangeText = useCallback(
    (next: string) => {
      const key = lastKey.current;
      lastKey.current = null;

      if (Platform.OS === 'ios' && !visible && key !== null && value.length > 1) {
        if (key === 'Backspace' && next === '') {
          onChangeText(value.slice(0, -1));
          return;
        }
        if (key.length === 1 && next === key) {
          onChangeText(value + key);
          return;
        }
      }

      onChangeText(next);
    },
    [value, visible, onChangeText],
  );

  return (
    <TextField
      {...rest}
      value={value}
      onChangeText={handleChangeText}
      onKeyPress={handleKeyPress}
      secureTextEntry={!visible}
      trailing={
        <Pressable
          onPress={() => setVisible((shown) => !shown)}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          hitSlop={theme.hitSlop}
          style={({ pressed }) => [{ padding: theme.spacing[8] }, pressed && { opacity: 0.6 }]}
          testID={rest.testID ? `${rest.testID}-toggle` : undefined}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      }
    />
  );
}
