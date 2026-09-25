import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useUseCases } from '@/app/di';
import { useAuth } from '@/app/providers/AuthProvider';
import { AppError } from '@/domain/repositories';
import { SIGN_UP_CODE_LENGTH } from '@/domain/usecases';
import { AppText } from '@/presentation/components/common/AppText';
import { Button } from '@/presentation/components/buttons/Button';
import { Logo } from '@/presentation/components/common/Logo';
import { ScreenContainer } from '@/presentation/components/layouts/ScreenContainer';
import { Spacer } from '@/presentation/components/common/Spacer';
import { TextField } from '@/presentation/components/inputs/TextField';
import { useCountdown } from '@/presentation/hooks/useCountdown';
import { env } from '@/shared/config';

/**
 * Entering the code from a password reset email.
 *
 * A code rather than a link because a code works wherever the email is read:
 * any phone, any email app, a computer — no link has to find its way back into
 * the app. Rendered by SignInScreen in place of its form, like the sign-up
 * code screen.
 *
 * A correct code signs the member in, and the auth gate then shows "Choose a
 * new password" (SetNewPasswordScreen) in front of everything else. While the
 * code is being checked the gate keeps this screen where it is, so a wrong code
 * is corrected here — see `verifying` in AuthProvider.
 *
 * Like the request that sent the email, it says nothing about whether the
 * address has an account: the wording is the same either way.
 */

type Props = {
  email: string;
  onBack: () => void;
};

export function ResetPasswordCodeScreen({ email, onBack }: Props): React.JSX.Element {
  const { verifyPasswordResetCode } = useAuth();
  const { requestPasswordReset } = useUseCases();
  // An email went out a moment ago, so the configured wait is already running.
  const cooldown = useCountdown(env.authResendCooldownSeconds);

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onContinue = useCallback(async () => {
    setError(null);
    setNotice(null);
    setIsVerifying(true);
    try {
      const result = await verifyPasswordResetCode(email, code);
      // On success the gate moves on by itself; this screen is unmounted.
      if (!result.ok) setError(result.error.message);
    } catch (caught) {
      setError(caught instanceof AppError ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setIsVerifying(false);
    }
  }, [verifyPasswordResetCode, email, code]);

  const onResend = useCallback(async () => {
    setError(null);
    setNotice(null);
    setIsResending(true);
    try {
      const result = await requestPasswordReset.execute(email);
      if (result.ok) {
        setCode('');
        setNotice(`If ${email} has an account, a new code is on its way.`);
        if (env.authResendCooldownSeconds !== null) cooldown.start(env.authResendCooldownSeconds);
        return;
      }

      setError(result.error.message);
      // The server's own figure when it gave one. None is invented.
      if (result.error.kind === 'rateLimited' && result.error.retryAfterSeconds !== undefined) {
        cooldown.start(result.error.retryAfterSeconds);
      }
    } catch (caught) {
      setError(caught instanceof AppError ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setIsResending(false);
    }
  }, [requestPasswordReset, email, cooldown]);

  const digits = code.replace(/\s/g, '');
  const canContinue = digits.length === SIGN_UP_CODE_LENGTH && !isVerifying;
  const waiting = cooldown.secondsLeft > 0;

  return (
    <ScreenContainer testID="screen-reset-code" scrollable avoidKeyboard edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Logo size={64} />
        <Spacer size={20} />
        <AppText variant="display" align="center">
          Check your email
        </AppText>
        <Spacer size={8} />
        <AppText variant="body" color="textSecondary" align="center" testID="reset-code-intro">
          {`If ${email} has an account, we sent a ${SIGN_UP_CODE_LENGTH}-digit code to it. Enter it to choose a new password.`}
        </AppText>
      </View>

      <View style={styles.actions}>
        <TextField
          label="Reset code"
          value={code}
          onChangeText={setCode}
          placeholder={'0'.repeat(SIGN_UP_CODE_LENGTH)}
          keyboardType="number-pad"
          // Lets iOS and Android offer the code straight from the email.
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoCorrect={false}
          testID="input-reset-code"
        />

        <Spacer size={16} />
        <Button
          label="Continue"
          onPress={() => void onContinue()}
          loading={isVerifying}
          disabled={!canContinue}
          fullWidth
          size="lg"
          testID="button-reset-continue"
        />

        <Spacer size={12} />
        <Button
          label={waiting ? `Send a new code in ${cooldown.secondsLeft}s` : 'Send a new code'}
          variant="outline"
          onPress={() => void onResend()}
          loading={isResending}
          disabled={waiting || isResending}
          fullWidth
          testID="button-reset-resend"
        />

        {error ? (
          <>
            <Spacer size={12} />
            <AppText variant="caption" color="danger" align="center" testID="reset-code-error">
              {error}
            </AppText>
          </>
        ) : null}

        {notice ? (
          <>
            <Spacer size={12} />
            <AppText variant="caption" color="primary" align="center" testID="reset-code-notice">
              {notice}
            </AppText>
          </>
        ) : null}

        <Spacer size={20} />
        <View style={styles.links}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            hitSlop={12}
            testID="link-reset-back"
          >
            <AppText variant="body" color="primary">
              Back to sign in
            </AppText>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', paddingTop: 24, paddingBottom: 24 },
  actions: { paddingBottom: 24 },
  links: { flexDirection: 'row', justifyContent: 'center' },
});
