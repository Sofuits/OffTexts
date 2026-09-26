import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import {
  AgeRangeField,
  AppText,
  ChoiceRow,
  ProfileSummary,
  Spacer,
} from '@/presentation/components';
import {
  useMyPhotos,
  useMyPreferences,
  useMyProfile,
  useMyProfileDetails,
} from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
import { MAX_AGE, MIN_AGE, profileCompleteness, usablePhotos } from '@/domain/entities';
import { COMMUNITY_GUIDELINES } from '@/shared/constants/app';
import { queryKeys } from '@/shared/constants/queryKeys';
import type { StepContext } from '../steps';

/* ----------------------------------------------------------- verification -- */

/**
 * A placeholder, and honest about it.
 *
 * A selfie check is coming; until it exists, what actually happens is that a
 * moderator looks at every profile before anybody else sees it. Saying that is
 * better than a button that pretends to verify something.
 */
export function VerificationBody(_props: StepContext): React.JSX.Element {
  const theme = useTheme();
  const points: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    {
      icon: 'person-circle-outline',
      text: 'A moderator looks at every new profile and its photos before anyone else can see it.',
    },
    {
      icon: 'camera-outline',
      text: 'Soon: a quick selfie check, so everyone you meet knows the face on the card is real.',
    },
    {
      icon: 'shield-checkmark-outline',
      text: 'Verified profiles get a badge. You’ll be told when yours is ready.',
    },
  ];

  return (
    <View style={{ gap: theme.spacing[16] }}>
      {points.map((point) => (
        <View key={point.text} style={[styles.row, { gap: theme.spacing[12] }]}>
          <Ionicons name={point.icon} size={22} color={theme.colors.primary} />
          <AppText variant="body" color="textSecondary" style={styles.grow}>
            {point.text}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------ preferences -- */

export function PreferencesBody({ draft, patch }: StepContext): React.JSX.Element {
  return (
    <>
      <AgeRangeField
        min={draft.ageMin}
        max={draft.ageMax}
        floor={MIN_AGE}
        ceiling={MAX_AGE}
        onChange={({ min, max }) => patch({ ageMin: min, ageMax: max })}
      />
      <Spacer size={16} />
      <AppText variant="caption" color="textDisabled">
        {`Showing people aged ${draft.ageMin} to ${draft.ageMax}. Nobody is told what you chose.`}
      </AppText>
    </>
  );
}

/* ------------------------------------------------------------- guidelines -- */

export function GuidelinesBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();

  return (
    <>
      <View style={{ gap: theme.spacing[20] }}>
        {COMMUNITY_GUIDELINES.map((rule) => (
          <View key={rule.title} style={[styles.rule, { gap: theme.spacing[12] }]}>
            <Ionicons name={rule.icon} size={22} color={theme.colors.primary} />
            <View style={styles.grow}>
              <AppText variant="bodyStrong">{rule.title}</AppText>
              <AppText
                variant="caption"
                color="textSecondary"
                style={{ marginTop: theme.spacing[2] }}
              >
                {rule.body}
              </AppText>
            </View>
          </View>
        ))}
      </View>

      <Spacer size={24} />
      <ChoiceRow
        label="I’ll keep to this"
        selected={draft.agreedToGuidelines}
        onPress={() => patch({ agreedToGuidelines: !draft.agreedToGuidelines })}
        mode="multiple"
        testID="choice-guidelines"
      />
    </>
  );
}

/* ---------------------------------------------------------- notifications -- */

export function NotificationsBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[12] }}>
      <ChoiceRow
        label="Yes, tell me"
        description="New people each morning, and the moment somebody you liked likes you back."
        selected={draft.pushEnabled === true}
        onPress={() => patch({ pushEnabled: true })}
        icon="notifications-outline"
        testID="choice-push-on"
      />
      <ChoiceRow
        label="No, I’ll check myself"
        description="Nothing will be sent. You can turn this on from your profile whenever you like."
        selected={draft.pushEnabled === false}
        onPress={() => patch({ pushEnabled: false })}
        icon="moon-outline"
        testID="choice-push-off"
      />
    </View>
  );
}

/* ---------------------------------------------------------------- preview -- */

/**
 * The profile as SAVED, on one screen, with a way back to each section.
 *
 * Read from the server rather than from the wizard's working copy, and
 * refreshed every time it opens. The working copy can hold answers the member
 * typed and then backed away from without pressing continue; showing those
 * here would tell them something was saved that was not, and the profile they
 * finish would not be the one they checked.
 *
 * Hidden answers are shown, marked "only you", rather than left out: a member
 * checking their profile needs to see that the answer was kept and that it is
 * hidden, not wonder whether it saved.
 */
export function PreviewBody({ goToSection }: StepContext): React.JSX.Element {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const profile = useMyProfile();
  const detailsQuery = useMyProfileDetails();
  const preferencesQuery = useMyPreferences();
  const photos = useMyPhotos();
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    let live = true;
    const keys = [
      queryKeys.profile.me(),
      queryKeys.profileDetails.mine(),
      queryKeys.preferences.mine(),
      queryKeys.photos.mine(),
    ];
    void Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))).finally(
      () => {
        if (live) setRefreshed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [queryClient]);

  const person = profile.data;
  const details = detailsQuery.data;
  const preferences = preferencesQuery.data;

  if (!refreshed || !person || !details || !preferences) {
    return (
      <View style={[styles.loading, { gap: theme.spacing[12] }]} testID="preview-loading">
        <ActivityIndicator />
        <AppText variant="caption" color="textSecondary">
          Loading your saved profile…
        </AppText>
      </View>
    );
  }

  const usable = usablePhotos(photos.data ?? []);
  const completeness = profileCompleteness(person, details, usable.length);
  const stale = profile.isError || detailsQuery.isError || preferencesQuery.isError;

  return (
    <>
      {stale ? (
        <AppText
          variant="caption"
          color="warning"
          style={{ marginBottom: theme.spacing[12] }}
          testID="preview-stale"
        >
          Couldn’t refresh just now — this may not include your latest answers.
        </AppText>
      ) : null}

      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          padding: theme.spacing[16],
        }}
        testID="profile-completeness"
      >
        <AppText variant="bodyStrong">{`Your profile is ${completeness.percent}% complete`}</AppText>
        <View
          style={[
            styles.track,
            { backgroundColor: theme.colors.inset, marginTop: theme.spacing[8] },
          ]}
        >
          <View
            style={[
              styles.fill,
              { width: `${completeness.percent}%`, backgroundColor: theme.colors.primary },
            ]}
          />
        </View>
        {completeness.missing.length > 0 ? (
          <AppText variant="caption" color="textSecondary" style={{ marginTop: theme.spacing[8] }}>
            {`To stand out: ${completeness.missing
              .slice(0, 3)
              .map((item) => item.label.toLowerCase())
              .join(', ')}.`}
          </AppText>
        ) : null}
      </View>

      {usable.length > 0 ? (
        <View style={[styles.photos, { gap: theme.spacing[8], marginTop: theme.spacing[16] }]}>
          {usable.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: photo.url }}
              style={[styles.thumb, { borderRadius: theme.radii.md }]}
              accessibilityIgnoresInvertColors
            />
          ))}
        </View>
      ) : null}

      <ProfileSummary
        person={person}
        details={details}
        preferences={preferences}
        photoCount={usable.length}
        viewer="self"
        onEdit={goToSection}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rule: { flexDirection: 'row', alignItems: 'flex-start' },
  grow: { flex: 1 },
  label: { width: 96 },
  loading: { alignItems: 'center', paddingVertical: 32 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  photos: { flexDirection: 'row', flexWrap: 'wrap' },
  thumb: { width: 64, height: 64 },
});
