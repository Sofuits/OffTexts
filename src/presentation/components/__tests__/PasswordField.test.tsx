import { fireEvent, render, screen } from '@testing-library/react-native';
import React, { useState } from 'react';
import { Platform } from 'react-native';

import { PasswordField } from '@/presentation/components';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

/**
 * The password field: show/hide, and one-character edits on iOS.
 *
 * iOS empties a hidden field when it is edited after losing focus. The native
 * side is not present under Jest, so these tests replay what iOS sends — a key
 * press, then the text it produced — and check what the field keeps.
 */

function Harness({ initial = '' }: { initial?: string }): React.JSX.Element {
  const [value, setValue] = useState(initial);
  return (
    <ThemeProvider>
      <PasswordField label="Password" value={value} onChangeText={setValue} testID="pw" />
    </ThemeProvider>
  );
}

const field = () => screen.getByTestId('pw');

describe('PasswordField', () => {
  it('starts hidden and can be shown and hidden again', () => {
    render(<Harness />);

    expect(field().props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByLabelText('Show password'));
    expect(field().props.secureTextEntry).toBe(false);
    fireEvent.press(screen.getByLabelText('Hide password'));
    expect(field().props.secureTextEntry).toBe(true);
  });

  describe('on iOS', () => {
    const original = Platform.OS;
    beforeAll(() => {
      Platform.OS = 'ios';
    });
    afterAll(() => {
      Platform.OS = original;
    });

    it('deletes one character when iOS reports the whole field cleared', () => {
      render(<Harness initial="secret12" />);

      fireEvent(field(), 'keyPress', { nativeEvent: { key: 'Backspace' } });
      fireEvent.changeText(field(), '');

      expect(field().props.value).toBe('secret1');
    });

    it('appends a character when iOS replaces the whole field with it', () => {
      render(<Harness initial="secret12" />);

      fireEvent(field(), 'keyPress', { nativeEvent: { key: '3' } });
      fireEvent.changeText(field(), '3');

      expect(field().props.value).toBe('secret123');
    });

    it('passes a paste or password-manager fill through untouched', () => {
      render(<Harness initial="secret12" />);

      // No key press: the text arrived all at once.
      fireEvent.changeText(field(), 'from-the-keychain');

      expect(field().props.value).toBe('from-the-keychain');
    });

    it('leaves ordinary typing alone', () => {
      render(<Harness initial="secret" />);

      fireEvent(field(), 'keyPress', { nativeEvent: { key: '1' } });
      fireEvent.changeText(field(), 'secret1');

      expect(field().props.value).toBe('secret1');
    });
  });
});
