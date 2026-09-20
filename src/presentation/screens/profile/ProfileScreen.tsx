import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Badge,
  Button,
  OfflineBanner,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  Spacer,
} from '@/presentation/components';
import { MEET_INTENT_LABELS } from '@/domain/entities';
import { useUseCases } from '@/app/di';
import { useMyProfile } from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { BottomTabScreenPropsFor } from '@/app/navigation/types';

type Props = BottomTabScreenPropsFor<'Profile'>;

const VERIFICATION_TONE = {
  verified: 'success',
  pending: 'warning',
  rejected: 'danger',
  unverified: 'textSecondary',
} as const;

/** Tab 1 — the signed-in member's own profile. */
export function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const profile = useMyProfile();
  const { signOut } = useUseCases();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const goToEdit = useCallback(() => navigation.navigate('EditProfile'), [navigation]);

  /**
   * Signing out does not navigate. The auth subscription changes the state and
   * RootNavigator swaps the branch, which unmounts this screen — so there is
   * nothing to push and no risk of leaving a signed-in screen behind.
   */
  const onSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You will need to sign in again to see your meets.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setIsSigningOut(true);
          void signOut.execute().finally(() => setIsSigningOut(false));
        },
      },
    ]);
  }, [signOut]);

  return (
    <ScreenContainer testID="screen-profile">
      <OfflineBanner />
      <ScreenHeader title="Your profile" subtitle="How you appear to other members" showLogo />
      <Spacer size={24} />

      <QueryBoundary
        isLoading={profile.isPending}
        error={profile.error}
        data={profile.data}
        onRetry={profile.refetch}
        isEmpty={() => false}
      >
        {(person) => (
          <>
            <View
              style={[
                styles.hero,
                {
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.radii.xl,
                  borderColor: theme.colors.border,
                  padding: theme.spacing[24],
                },
              ]}
            >
              <Avatar name={person.name} uri={person.photoUrls[0]} size={88} />
              <Spacer size={16} />
              <AppText variant="subheading">{person.name}</AppText>
              <AppText variant="body" color="textSecondary" align="center">
                {person.city}
              </AppText>

              <View style={[styles.tags, { marginTop: theme.spacing[16], gap: theme.spacing[8] }]}>
                {person.intents.map((intent) => (
                  <Badge key={intent} label={MEET_INTENT_LABELS[intent]} tone="primary" />
                ))}
              </View>

              <Spacer size={20} />
              <Button
                label="Edit profile"
                onPress={goToEdit}
                fullWidth
                testID="button-edit-profile"
              />
            </View>

            <Spacer size={32} />
            <SectionHeader title="Photos" subtitle="Up to six, shown in this order" />
            <Spacer size={12} />
            <View style={[styles.photoRow, { gap: theme.spacing[12] }]}>
              {[0, 1, 2].map((index) => (
                <View
                  key={index}
                  style={[
                    styles.photoTile,
                    {
                      borderRadius: theme.radii.md,
                      backgroundColor: theme.colors.inset,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <AppText variant="caption" color="textDisabled">
                    {index + 1}
                  </AppText>
                </View>
              ))}
            </View>

            <Spacer size={32} />
            <SectionHeader title="Personal details" />
            <Spacer size={8} />
            <View
              style={[
                styles.detailCard,
                {
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.radii.lg,
                  borderColor: theme.colors.border,
                  paddingHorizontal: theme.spacing[16],
                },
              ]}
            >
              {(
                [
                  ['Name', person.name],
                  ['City', person.city],
                  ['Headline', person.headline],
                ] as const
              ).map(([label, value], index) => (
                <View
                  key={label}
                  style={[
                    styles.detailRow,
                    {
                      paddingVertical: theme.spacing[16],
                      borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: theme.colors.border,
                    },
                  ]}
                >
                  <AppText variant="label" color="textSecondary">
                    {label}
                  </AppText>
                  <AppText variant="body" style={styles.detailValue}>
                    {value}
                  </AppText>
                </View>
              ))}

              <View
                style={[
                  styles.detailRow,
                  {
                    paddingVertical: theme.spacing[16],
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.colors.border,
                  },
                ]}
              >
                <AppText variant="label" color="textSecondary">
                  Verification
                </AppText>
                <Badge label={person.verification} tone={VERIFICATION_TONE[person.verification]} />
              </View>
            </View>

            <Spacer size={32} />
            <Button
              label="Sign out"
              variant="outline"
              fullWidth
              loading={isSigningOut}
              onPress={onSignOut}
              testID="button-sign-out"
            />
          </>
        )}
      </QueryBoundary>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  photoRow: { flexDirection: 'row' },
  photoTile: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCard: { borderWidth: StyleSheet.hairlineWidth },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  detailValue: { flexShrink: 1, textAlign: 'right' },
});
