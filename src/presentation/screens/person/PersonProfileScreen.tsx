import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Badge,
  Button,
  QueryBoundary,
  ScreenContainer,
  SectionHeader,
  Spacer,
} from '@/presentation/components';
import { MEET_INTENT_LABELS } from '@/domain/entities';
import { useProfileById } from '@/presentation/hooks';
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
export function PersonProfileScreen({ route }: Props): React.JSX.Element {
  const theme = useTheme();
  const { personId } = route.params;
  const profile = useProfileById(personId);

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
            <SectionHeader title="About" />
            <Spacer size={8} />
            <AppText variant="body" color="textSecondary">
              {person.bio ?? person.headline}
            </AppText>

            <Spacer size={24} />
            <SectionHeader title="Looking for" />
            <Spacer size={12} />
            <View style={[styles.tags, { gap: theme.spacing[8] }]}>
              {person.intents.map((intent) => (
                <Badge key={intent} label={MEET_INTENT_LABELS[intent]} tone="primary" />
              ))}
            </View>

            <Spacer size={24} />
            <SectionHeader title="Interests" />
            <Spacer size={12} />
            <View style={[styles.tags, { gap: theme.spacing[8] }]}>
              {person.interests.map((interest) => (
                <Badge key={interest} label={interest} />
              ))}
            </View>

            <Spacer size={32} />
            <Button label="Request a meet" fullWidth disabled />
            <Spacer size={12} />
            <AppText variant="caption" color="textSecondary" align="center">
              Requesting a meet arrives with the meets feature.
            </AppText>
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
