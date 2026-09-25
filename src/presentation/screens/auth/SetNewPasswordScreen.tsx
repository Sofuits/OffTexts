import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useContainer, useUseCases } from '@/app/di';
import { useAuth } from '@/app/providers/AuthProvider';
import { AppError } from '@/domain/repositories';
import { passwordChecks } from '@/domain/usecases';
import { AppText } from '@/presentation/components/common/AppText';
import { Button } from '@/presentation/components/buttons/Button';
import { Logo } from '@/presentation/components/common/Logo';
import { ScreenContainer } from '@/presentation/components/layouts/ScreenContainer';
import { Spacer } from '@/presentation/components/common/Spacer';
import { PasswordChecklist } from '@/presentation/components/inputs/PasswordChecklist';
import { PasswordField } from '@/presentation/components/inputs/PasswordField';
import { useTheme } from '@/presentation/hooks/useTheme';

/**
 * Choosing a new password after following the reset link.
 *
 * Shown by RootNavigator in front of everything while a recovery is under way
 * — see `PasswordRecovery` in AuthProvider for why that is gate state and not
 * a route. Three things it can be showing:
 *
 *   - the link was bad        → say so, and go back to sign in
 *   - the session is not set  → a moment's spinner
 *   - signed in from the link → the new password form
 *
 * Saving the password ends the recovery and the gate shows the app, because
 * the member is already signed in. "Not now" does the same without changing
 * anything: the link proved they own the address, exactly as signing in does.
 */
export function SetNewPasswordScreen(): React.JSX.Element {
  const theme = useTheme();
  const { updatePassword } = useUseCases();
  const { passwordRecovery, isSignedIn, endPasswordRecovery } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { passwordRequirement } = useContainer();
  const checks = useMemo(
    () => passwordChecks(password, passwordRequirement),
    [password, passwordRequirement],
  );

  const onSave = useCallback(async () => {
    setError(null);
    setIsSaving(true);
    try {
      const result = await updatePassword.execute({ password, confirmPassword });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      endPasswordRecovery();
    } catch (caught) {
      setError(caught instanceof AppError ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setIsSaving(false);
    }
  }, [updatePassword, password, confirmPassword, endPasswordRecovery]);

  if (passwordRecovery.status === 'failed') {
    return (
      <ScreenContainer testID="screen-set-new-password" edges={['top', 'bottom']}>
        <View style={styles.centred}>
          <Logo size={64} />
          <Spacer size={20} />
          <AppText variant="display" align="center">
            Link not valid
          </AppText>
          <Spacer size={8} />
          <AppText variant="body" color="textSecondary" align="center" testID="reset-link-error">
            {passwordRecovery.message}
          </AppText>
          <Spacer size={24} />
          <Button
            label="Back to sign in"
            onPress={endPasswordRecovery}
            fullWidth
            testID="button-reset-back"
          />
        </View>
      </ScreenContainer>
    );
  }

  if (!isSignedIn) {
    return (
      <View
        testID="screen-set-new-password"
        style={[styles.centred, { backgroundColor: theme.colors.background }]}
      >
        <Logo size={64} />
        <Spacer size={24} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScreenContainer
      testID="screen-set-new-password"
      scrollable
      avoidKeyboard
      edges={['top', 'bottom']}
    >
      <View style={styles.body}>
        <Logo size={64} />
        <Spacer size={20} />
        <AppText variant="display" align="center">
          Choose a new password
        </AppText>
        <Spacer size={8} />
        <AppText variant="body" color="textSecondary" align="center">
          A few words you’ll remember beats a short jumble you won’t.
        </AppText>
      </View>

      <View style={styles.actions}>
        <PasswordField
          label="New password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          testID="input-new-password"
        />
        <PasswordChecklist checks={checks} />
        <Spacer size={12} />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          testID="input-confirm-new-password"
        />

        <Spacer size={16} />
        <Button
          label="Save password"
          onPress={() => void onSave()}
          loading={isSaving}
          disabled={password.length === 0 || isSaving}
          fullWidth
          size="lg"
          testID="button-save-password"
        />

        {error ? (
          <>
            <Spacer size={12} />
            <AppText variant="caption" color="danger" align="center" testID="set-password-error">
              {error}
            </AppText>
          </>
        ) : null}

        <Spacer size={12} />
        <Button
          label="Not now"
          variant="ghost"
          onPress={endPasswordRecovery}
          fullWidth
          testID="button-skip-new-password"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { alignItems: 'center', paddingTop: 24, paddingBottom: 24 },
  actions: { paddingBottom: 24 },
});
