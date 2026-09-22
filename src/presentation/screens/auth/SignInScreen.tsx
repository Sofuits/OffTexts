import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppError } from '@/domain/repositories';
import { env } from '@/shared/config';
import { useUseCases } from '@/app/di';
import { AppText } from '@/presentation/components/common/AppText';
import { Button } from '@/presentation/components/buttons/Button';
import { Logo } from '@/presentation/components/common/Logo';
import { ScreenContainer } from '@/presentation/components/layouts/ScreenContainer';
import { Spacer } from '@/presentation/components/common/Spacer';
import { TextField } from '@/presentation/components/inputs/TextField';

/**
 * Sign in.
 *
 * Google is the only option a member ever sees. The screen does not know that
 * Google means OAuth, a browser, or Supabase — it calls a use case and renders
 * three outcomes: signed in (navigation reacts on its own), cancelled (say
 * nothing), or failed (say what went wrong).
 *
 * Cancellation showing nothing is the detail worth protecting. Someone who
 * opened the browser and changed their mind has done nothing wrong, and an
 * error message there makes a working app feel broken.
 *
 * Below it, and only outside production, there is an email and password form.
 * It exists because every Row Level Security policy on the database requires an
 * authenticated caller: without a session the app can read nothing and write
 * nothing, so the whole data layer is untestable until someone is signed in.
 * Waiting for Google to be configured would mean waiting to find out whether
 * any of the Supabase repositories work at all.
 *
 * It uses the same `SignIn` use case a real member would, so this is not a
 * bypass — it is the same door with a different key. `env.isProduction` decides
 * whether it renders, and that value comes from the build, not from a runtime
 * toggle anyone can flip.
 */
export function SignInScreen(): React.JSX.Element {
  const { signInWithGoogle, signIn } = useUseCases();

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDevForm, setShowDevForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onGooglePress = useCallback(async () => {
    setError(null);
    setIsBusy(true);

    try {
      const result = await signInWithGoogle.execute();

      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      // On success the auth subscription moves the navigator to the tabs;
      // there is nothing to do here, and nothing to say on a cancellation.
    } catch (caught) {
      setError(caught instanceof AppError ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setIsBusy(false);
    }
  }, [signInWithGoogle]);

  const onDevSignInPress = useCallback(async () => {
    setError(null);
    setIsBusy(true);

    try {
      const result = await signIn.execute({ email, password });
      if (!result.ok) setError(result.error.message);
      // On success the auth subscription moves the navigator, same as Google.
    } catch (caught) {
      setError(caught instanceof AppError ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setIsBusy(false);
    }
  }, [signIn, email, password]);

  return (
    // Closed, the screen is one static frame with the logo centred. Open, the
    // form makes it taller than a short phone, so it scrolls — and ScrollView's
    // `keyboardShouldPersistTaps` means the Sign in button still responds while
    // the keyboard is up, which a plain View would not.
    <ScreenContainer testID="screen-sign-in" scrollable={showDevForm} edges={['top', 'bottom']}>
      <View style={showDevForm ? styles.bodyScrolling : styles.body}>
        <Logo size={88} />
        <Spacer size={24} />

        <AppText variant="display" align="center">
          Offtexts
        </AppText>
        <Spacer size={8} />
        <AppText variant="body" color="textSecondary" align="center">
          Meet verified people you’re interested in. Skip the endless chat.
        </AppText>
      </View>

      <View style={styles.actions}>
        <Button
          label="Continue with Google"
          onPress={onGooglePress}
          loading={isBusy}
          fullWidth
          size="lg"
          testID="button-google-sign-in"
        />

        {error ? (
          <>
            <Spacer size={12} />
            <AppText variant="caption" color="danger" align="center" testID="sign-in-error">
              {error}
            </AppText>
          </>
        ) : null}

        {env.isProduction ? null : (
          <View testID="dev-sign-in">
            <Spacer size={16} />
            <Pressable
              onPress={() => setShowDevForm((open) => !open)}
              accessibilityRole="button"
              hitSlop={12}
              testID="button-toggle-dev-sign-in"
            >
              <AppText variant="body" color="primary" align="center">
                {showDevForm ? 'Hide developer sign-in' : 'Developer sign-in'}
              </AppText>
            </Pressable>

            {showDevForm ? (
              <>
                <Spacer size={12} />
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  testID="input-dev-email"
                />
                <Spacer size={12} />
                <TextField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  testID="input-dev-password"
                />
                <Spacer size={16} />
                <Button
                  label="Sign in with email"
                  variant="secondary"
                  onPress={onDevSignInPress}
                  loading={isBusy}
                  fullWidth
                  testID="button-dev-sign-in"
                />
                <Spacer size={12} />
                <AppText variant="caption" color="textDisabled" align="center">
                  Development builds only. Create the account in the Supabase dashboard under
                  Authentication → Users.
                </AppText>
              </>
            ) : null}
          </View>
        )}

        <Spacer size={20} />
        <AppText variant="caption" color="textDisabled" align="center">
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
  bodyScrolling: { alignItems: 'center', paddingTop: 24, paddingBottom: 28 },
  actions: { paddingBottom: 24 },
});
