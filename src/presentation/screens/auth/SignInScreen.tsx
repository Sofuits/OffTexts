import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppError } from '@/domain/repositories';
import { useUseCases } from '@/app/di';
import { AppText } from '@/presentation/components/common/AppText';
import { Button } from '@/presentation/components/buttons/Button';
import { Logo } from '@/presentation/components/common/Logo';
import { ScreenContainer } from '@/presentation/components/layouts/ScreenContainer';
import { Spacer } from '@/presentation/components/common/Spacer';

/**
 * Sign in.
 *
 * Google only. The screen does not know that Google means OAuth, a browser, or
 * Supabase — it calls a use case and renders three outcomes: signed in
 * (navigation reacts on its own), cancelled (say nothing), or failed (say what
 * went wrong).
 *
 * Cancellation showing nothing is the detail worth protecting. Someone who
 * opened the browser and changed their mind has done nothing wrong, and an
 * error message there makes a working app feel broken.
 */
export function SignInScreen(): React.JSX.Element {
  const { signInWithGoogle } = useUseCases();

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <ScreenContainer testID="screen-sign-in" scrollable={false} edges={['top', 'bottom']}>
      <View style={styles.body}>
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
  actions: { paddingBottom: 24 },
});
