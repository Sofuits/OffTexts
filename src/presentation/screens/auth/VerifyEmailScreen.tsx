import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useUseCases } from '@/app/di';
import { AppError } from '@/domain/repositories';
import { SIGN_UP_CODE_LENGTH } from '@/domain/usecases';
import { AppText } from '@/presentation/components/common/AppText';
import { Button } from '@/presentation/components/buttons/Button';
import { Logo } from '@/presentation/components/common/Logo';
import { ScreenContainer } from '@/presentation/components/layouts/ScreenContainer';
import { Spacer } from '@/presentation/components/common/Spacer';
import { TextField } from '@/presentation/components/inputs/TextField';
import { env } from '@/shared/config';

/**
 * Entering the code from the sign-up email.
 *
 * Rendered by SignInScreen in place of its form, not pushed as a route: it is
 * a step of signing up, it needs nothing the navigator provides, and keeping
 * it out of the stack means there is no back gesture into a half-finished
 * sign-up form.
 *
 * A correct code signs the member in — `verifyOtp` returns a session — so
 * success needs no handling here. The auth subscription moves the gate.
 *
 * THE RESEND COUNTDOWN
 * Its length is `env.authResendCooldownSeconds`, copied from the Supabase
 * Dashboard. When that is not configured there is no countdown of our own; the
 * button then waits only when Supabase refuses a resend, for the number of
 * seconds Supabase states. A figure invented here would either make members
 * wait for no reason or offer a button the server then refuses.
 */

type Props = {
  email: string;
  /** True when an email was sent just before this screen opened. */
  codeJustSent: boolean;
  onBack: () => void;
};

/** Seconds remaining until `until`, never negative. */
const secondsUntil = (until: number | null): number =>
  until === null ? 0 : Math.max(0, Math.ceil((until - Date.now()) / 1000));

/** @param initialSeconds A countdown already running when the screen opens, or null. */
function useCountdown(initialSeconds: number | null): {
  secondsLeft: number;
  start: (seconds: number) => void;
} {
  const [until, setUntil] = useState<number | null>(() =>
    initialSeconds === null ? null : Date.now() + initialSeconds * 1000,
  );
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds ?? 0);

  useEffect(() => {
    if (until === null) return;

    // Recomputed from the end time on every tick rather than decremented, so a
    // backgrounded app comes back showing the right number, not a paused one.
    const timer = setInterval(() => {
      const left = secondsUntil(until);
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(timer);
        setUntil(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [until]);

  const start = useCallback((seconds: number) => {
    setUntil(Date.now() + seconds * 1000);
    setSecondsLeft(seconds);
  }, []);

  return { secondsLeft, start };
}

export function VerifyEmailScreen({ email, codeJustSent, onBack }: Props): React.JSX.Element {
  const { verifyEmail, resendVerificationCode } = useUseCases();
  // A code was emailed a moment ago, so the configured wait is already running.
  const cooldown = useCountdown(codeJustSent ? env.authResendCooldownSeconds : null);

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onVerify = useCallback(async () => {
    setError(null);
    setNotice(null);
    setIsVerifying(true);
    try {
      const result = await verifyEmail.execute({ email, code });
      if (!result.ok) setError(result.error.message);
    } catch (caught) {
      setError(caught instanceof AppError ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setIsVerifying(false);
    }
  }, [verifyEmail, email, code]);

  const onResend = useCallback(async () => {
    setError(null);
    setNotice(null);
    setIsResending(true);
    try {
      const result = await resendVerificationCode.execute(email);
      if (result.ok) {
        setCode('');
        setNotice(`We sent a new code to ${email}.`);
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
  }, [resendVerificationCode, email, cooldown]);

  const digits = code.replace(/\s/g, '');
  const canVerify = digits.length === SIGN_UP_CODE_LENGTH && !isVerifying;
  const waiting = cooldown.secondsLeft > 0;

  return (
    <ScreenContainer
      testID="screen-verify-email"
      scrollable
      avoidKeyboard
      edges={['top', 'bottom']}
    >
      <View style={styles.body}>
        <Logo size={64} />
        <Spacer size={20} />
        <AppText variant="display" align="center">
          Check your email
        </AppText>
        <Spacer size={8} />
        <AppText variant="body" color="textSecondary" align="center">
          {codeJustSent
            ? `We sent a ${SIGN_UP_CODE_LENGTH}-digit code to ${email}. Enter it to finish creating your account.`
            : `Enter the ${SIGN_UP_CODE_LENGTH}-digit code we sent to ${email}. If you cannot find it, send a new one.`}
        </AppText>
      </View>

      <View style={styles.actions}>
        <TextField
          label="Verification code"
          value={code}
          onChangeText={setCode}
          placeholder={'0'.repeat(SIGN_UP_CODE_LENGTH)}
          keyboardType="number-pad"
          // Lets iOS and Android offer the code straight from the email.
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoCorrect={false}
          testID="input-code"
        />

        <Spacer size={16} />
        <Button
          label="Verify email"
          onPress={() => void onVerify()}
          loading={isVerifying}
          disabled={!canVerify}
          fullWidth
          size="lg"
          testID="button-verify"
        />

        <Spacer size={12} />
        <Button
          label={waiting ? `Send a new code in ${cooldown.secondsLeft}s` : 'Send a new code'}
          variant="outline"
          onPress={() => void onResend()}
          loading={isResending}
          disabled={waiting || isResending}
          fullWidth
          testID="button-resend"
        />

        {error ? (
          <>
            <Spacer size={12} />
            <AppText variant="caption" color="danger" align="center" testID="verify-error">
              {error}
            </AppText>
          </>
        ) : null}

        {notice ? (
          <>
            <Spacer size={12} />
            <AppText variant="caption" color="primary" align="center" testID="verify-notice">
              {notice}
            </AppText>
          </>
        ) : null}

        <Spacer size={20} />
        <View style={styles.links}>
          <Pressable onPress={onBack} accessibilityRole="button" hitSlop={12} testID="link-back">
            <AppText variant="body" color="primary">
              Back to sign in
            </AppText>
          </Pressable>
        </View>

        <Spacer size={12} />
        <AppText variant="caption" color="textDisabled" align="center">
          Already have an account with this email? Go back and sign in instead.
        </AppText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', paddingTop: 24, paddingBottom: 24 },
  actions: { paddingBottom: 24 },
  links: { flexDirection: 'row', justifyContent: 'center' },
});
