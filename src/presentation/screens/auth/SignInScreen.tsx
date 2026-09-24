import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppError } from '@/domain/repositories';
import { MIN_PASSWORD_LENGTH } from '@/domain/usecases';
import { env } from '@/shared/config';
import { useUseCases } from '@/app/di';
import { AppText } from '@/presentation/components/common/AppText';
import { Button } from '@/presentation/components/buttons/Button';
import { Logo } from '@/presentation/components/common/Logo';
import { ScreenContainer } from '@/presentation/components/layouts/ScreenContainer';
import { Spacer } from '@/presentation/components/common/Spacer';
import { TextField } from '@/presentation/components/inputs/TextField';

/**
 * Sign in, and create an account.
 *
 * Email and password is the real path, not a developer shortcut. Everything
 * behind the auth gate needs a session — every Row Level Security policy on the
 * database requires an authenticated caller — so until somebody can actually
 * sign up, nothing in the product can be used by anyone who is not already in
 * the Supabase dashboard.
 *
 * WHY THERE MAY BE NO GOOGLE BUTTON
 * Google sign-in needs an OAuth client in Google Cloud and the provider enabled
 * in Supabase. Until both exist, tapping it returns "Unsupported provider:
 * provider is not enabled" — an error on the first screen of the app that the
 * member can do nothing about. `env.enableGoogleAuth` is false by default, so
 * the option appears the day it works and not before. Nothing else changes; the
 * code path is still here and still tested.
 *
 * The screen knows nothing about Supabase, OAuth or browsers. It calls use
 * cases and renders what comes back.
 */

type Mode = 'signIn' | 'signUp' | 'reset';

const COPY: Record<Mode, { title: string; subtitle: string; action: string }> = {
  signIn: {
    title: 'Welcome back',
    subtitle: 'Meet verified people you’re interested in. Skip the endless chat.',
    action: 'Sign in',
  },
  signUp: {
    title: 'Create your account',
    subtitle: 'You’ll build your profile next. You must be 18 or older to join.',
    action: 'Create account',
  },
  reset: {
    title: 'Reset your password',
    subtitle: 'We’ll email you a link. It expires shortly, so use it soon.',
    action: 'Send the link',
  },
};

export function SignInScreen(): React.JSX.Element {
  const { signInWithGoogle, signIn, signUp, requestPasswordReset } = useUseCases();

  const [mode, setMode] = useState<Mode>('signIn');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const copy = COPY[mode];

  // Clearing the messages on a mode switch matters more than it looks. Without
  // it, "The two passwords do not match" stays on screen after switching to
  // sign-in, where there is no second password field — so the member is told
  // to fix something that is no longer in front of them.
  const changeMode = useCallback((next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setConfirmPassword('');
  }, []);

  const run = useCallback(async (work: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    setIsBusy(true);
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof AppError ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setIsBusy(false);
    }
  }, []);

  const onSubmit = useCallback(() => {
    void run(async () => {
      if (mode === 'reset') {
        const result = await requestPasswordReset.execute(email);
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        // Deliberately says nothing about whether the account exists. See
        // RequestPasswordReset — "no account with that email" would turn this
        // form into a way to find out who is a member.
        setNotice(`If ${email.trim()} has an account, a reset link is on its way.`);
        return;
      }

      if (mode === 'signUp') {
        const result = await signUp.execute({ email, password, confirmPassword });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        if (result.value.status === 'confirmationRequired') {
          // The mode is changed directly rather than through changeMode(),
          // which clears the messages — and the message is the entire point of
          // this branch. changeMode() is for a member tapping a link, where a
          // stale error from the previous mode has to go.
          setMode('signIn');
          setConfirmPassword('');
          setNotice(
            `Check ${result.value.email} for a confirmation link. You can sign in once you’ve clicked it.`,
          );
        }
        // On 'signedIn' the auth subscription moves the navigator; nothing to do.
        return;
      }

      const result = await signIn.execute({ email, password });
      if (!result.ok) setError(result.error.message);
    });
  }, [run, mode, email, password, confirmPassword, signIn, signUp, requestPasswordReset]);

  /**
   * One tap into a real session, in development only.
   *
   * It signs in properly rather than faking anything: a real Supabase session,
   * real Row Level Security, real rows. That is the difference between this and
   * `DEV_SKIP_AUTH`, which forces the in-memory repositories and therefore
   * exercises no policy at all.
   *
   * `env.hasDemoSignIn` is false in production no matter what the variables
   * say, so this cannot ship.
   */
  const onDemoPress = useCallback(() => {
    void run(async () => {
      const result = await signIn.execute({
        email: env.demoEmail,
        password: env.demoPassword,
      });
      if (!result.ok) {
        // Usually means the account has not been created yet, or the password
        // in `.env` no longer matches it. Said plainly, because the person
        // reading it is the one who can fix it.
        setError(`${result.error.message} (demo account: ${env.demoEmail})`);
      }
    });
  }, [run, signIn]);

  const onGooglePress = useCallback(() => {
    void run(async () => {
      const result = await signInWithGoogle.execute();
      // A member who opened the browser and backed out has done nothing wrong.
      // Showing an error there makes a working app feel broken, so a cancelled
      // result says nothing at all.
      if (!result.ok) setError(result.error.message);
    });
  }, [run, signInWithGoogle]);

  // The screen is taller than a short phone in sign-up mode, so it scrolls.
  // ScrollView's keyboardShouldPersistTaps is what keeps the submit button
  // responsive while the keyboard is up.
  // The demo block adds about 140dp, which is enough to push the submit button
  // off a short phone in sign-in mode. It is only ever present in development,
  // so this does not change the production layout at all.
  const scrollable = mode !== 'signIn' || env.hasDemoSignIn;

  const submitDisabled = useMemo(() => {
    if (!email.trim()) return true;
    if (mode === 'reset') return false;
    return password.length === 0;
  }, [email, password, mode]);

  return (
    <ScreenContainer testID="screen-sign-in" scrollable={scrollable} edges={['top', 'bottom']}>
      <View style={scrollable ? styles.bodyScrolling : styles.body}>
        <Logo size={scrollable ? 64 : 88} />
        <Spacer size={20} />
        <AppText variant="display" align="center">
          {copy.title}
        </AppText>
        <Spacer size={8} />
        <AppText variant="body" color="textSecondary" align="center">
          {copy.subtitle}
        </AppText>
      </View>

      <View style={styles.actions}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          testID="input-email"
        />

        {mode === 'reset' ? null : (
          <>
            <Spacer size={12} />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              // `newPassword` rather than `password` on sign-up is what makes a
              // password manager offer to generate and save one instead of
              // trying to fill an account that does not exist yet.
              textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
              testID="input-password"
            />
          </>
        )}

        {mode === 'signUp' ? (
          <>
            <Spacer size={12} />
            <TextField
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              testID="input-confirm-password"
            />
            <Spacer size={8} />
            <AppText variant="caption" color="textSecondary">
              At least {MIN_PASSWORD_LENGTH} characters. A few words you’ll remember beats a short
              jumble you won’t.
            </AppText>
          </>
        ) : null}

        <Spacer size={16} />
        <Button
          label={copy.action}
          onPress={onSubmit}
          loading={isBusy}
          disabled={submitDisabled}
          fullWidth
          size="lg"
          testID="button-submit"
        />

        {error ? (
          <>
            <Spacer size={12} />
            <AppText variant="caption" color="danger" align="center" testID="sign-in-error">
              {error}
            </AppText>
          </>
        ) : null}

        {notice ? (
          <>
            <Spacer size={12} />
            <AppText variant="caption" color="primary" align="center" testID="sign-in-notice">
              {notice}
            </AppText>
          </>
        ) : null}

        {env.enableGoogleAuth ? (
          <>
            <Spacer size={16} />
            <AppText variant="caption" color="textSecondary" align="center">
              or
            </AppText>
            <Spacer size={12} />
            <Button
              label="Continue with Google"
              variant="secondary"
              onPress={onGooglePress}
              loading={isBusy}
              fullWidth
              testID="button-google-sign-in"
            />
          </>
        ) : null}

        {env.hasDemoSignIn ? (
          <>
            <Spacer size={16} />
            <View style={[styles.divider]}>
              <AppText variant="caption" color="textSecondary" align="center">
                development only
              </AppText>
            </View>
            <Spacer size={12} />
            <Button
              label="Demo sign-in"
              variant="outline"
              onPress={onDemoPress}
              loading={isBusy}
              fullWidth
              testID="button-demo-sign-in"
            />
            <Spacer size={8} />
            <AppText variant="caption" color="textSecondary" align="center">
              Signs in as {env.demoEmail} against the real database. This button does not exist in a
              production build.
            </AppText>
          </>
        ) : null}

        <Spacer size={20} />
        <View style={styles.links}>
          {mode === 'signIn' ? (
            <>
              <Pressable
                onPress={() => changeMode('signUp')}
                accessibilityRole="button"
                hitSlop={12}
                testID="link-sign-up"
              >
                <AppText variant="body" color="primary">
                  Create an account
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => changeMode('reset')}
                accessibilityRole="button"
                hitSlop={12}
                testID="link-reset"
              >
                <AppText variant="body" color="textSecondary">
                  Forgot password?
                </AppText>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => changeMode('signIn')}
              accessibilityRole="button"
              hitSlop={12}
              testID="link-sign-in"
            >
              <AppText variant="body" color="primary">
                Back to sign in
              </AppText>
            </Pressable>
          )}
        </View>

        <Spacer size={16} />
        <AppText variant="caption" color="textSecondary" align="center">
          By continuing you agree to our terms and privacy notice. You must be 18 or older.
        </AppText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // `flex: 1` inside a ScrollView's content container collapses to zero height,
  // so the scrolling variant sizes to its content instead.
  bodyScrolling: { alignItems: 'center', paddingTop: 24, paddingBottom: 24 },
  actions: { paddingBottom: 24 },
  divider: { alignItems: 'center' },
  links: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
