import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Badge,
  Button,
  ProfileSummary,
  QueryBoundary,
  ScreenContainer,
  SectionHeader,
  Spacer,
} from '@/presentation/components';
import { MEET_INTENT_LABELS } from '@/domain/entities';
import { useProfileById, useProfileDetailsFor } from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { RootStackScreenProps } from '@/app/navigation/types';

type Props = RootStackScreenProps<'PersonProfile'>;

/**
 * Another member's profile.
 *
 * `personName` is passed in the route params as well as being on the fetched
 * profile. That is not redundancy: it lets the header show the right name
 * immediately instead of "Loading…" for the first few hundred milliseconds.
 */
export function PersonProfileScreen({ route, navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const { personId, personName, matchId } = route.params;
  const profile = useProfileById(personId);
  // Optional: the profile shows without it. A member who shared nothing, or a
  // request that failed, costs the details sections and nothing else.
  const details = useProfileDetailsFor(personId);

  return (
    <ScreenContainer testID="screen-person-profile" edges={['bottom']}>
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
              <AppText variant="subheading" align="center">
                {person.age ? `${person.name}, ${person.age}` : person.name}
              </AppText>
              <AppText variant="body" color="primary" align="center">
                {person.city}
              </AppText>
              {person.verification === 'verified' ? (
                <>
                  <Spacer size={12} />
                  <Badge label="ID verified" tone="success" />
                </>
              ) : null}
            </View>

            <Spacer size={24} />
            <SectionHeader title="Looking for" />
            <Spacer size={12} />
            <View style={[styles.tags, { gap: theme.spacing[8] }]}>
              {person.intents.map((intent) => (
                <Badge key={intent} label={MEET_INTENT_LABELS[intent]} tone="primary" />
              ))}
            </View>

            {/* Only what they chose to share: hidden answers, and answers for
                a purpose they are not here for now, are removed on the server
                before they reach this phone. */}
            <ProfileSummary
              person={person}
              details={details.data ?? null}
              viewer="other"
              sections={[
                'Basics',
                'Location',
                'Education & work',
                'Lifestyle',
                'Dating',
                'Life partner',
                'Co-founder',
                'About you',
              ]}
            />

            <Spacer size={32} />
            {/*
              The button appears only with a match, because only a match
              permits a booking — `api_v1.request_meeting` looks the match up
              under the caller's own RLS and refuses without one. Offering the
              button anyway would be offering a 403.
            */}
            {matchId ? (
              <Button
                label="Arrange a meet"
                fullWidth
                size="lg"
                onPress={() => navigation.navigate('RequestMeet', { matchId, personName })}
                testID="button-request-meet"
              />
            ) : (
              <>
                <Button label="Arrange a meet" fullWidth size="lg" disabled />
                <Spacer size={12} />
                <AppText variant="caption" color="textSecondary" align="center">
                  You can book a table once you have both said yes.
                </AppText>
              </>
            )}
          </>
        )}
      </QueryBoundary>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
});
