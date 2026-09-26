import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Badge,
  Button,
  OfflineBanner,
  PhotoGrid,
  ProfileSummary,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  Spacer,
} from '@/presentation/components';
import {
  GENDER_PLURAL_LABELS,
  MEET_INTENT_LABELS,
  missingCategoryAnswer,
  moderationSummary,
  type Person,
  type Preferences,
  type ProfileDetails,
} from '@/domain/entities';
import type { ProfileSection } from '@/presentation/components';
import { useUseCases } from '@/app/di';
import {
  useMyPreferences,
  useMyProfile,
  useMyProfileDetails,
  usePhotoUpload,
} from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { BottomTabScreenPropsFor } from '@/app/navigation/types';
import { toSentenceList } from '@/shared/utils/helpers';

type Props = BottomTabScreenPropsFor<'Profile'>;

const VERIFICATION = {
  verified: { tone: 'success', label: 'ID verified' },
  pending: { tone: 'warning', label: 'Being checked' },
  rejected: { tone: 'danger', label: 'Needs another look' },
  unverified: { tone: 'textSecondary', label: 'Not verified yet' },
} as const;

/**
 * Tab 1 — the member's own profile.
 *
 * Two things here that a profile screen usually gets wrong.
 *
 * The photos are the member's OWN rows, not `person.photoUrls`. That array is
 * the approved subset everybody else sees, so a photo uploaded ten minutes ago
 * is not in it — reading from it would mean a member uploads a photo and it
 * appears to vanish. `useMyPhotos()` returns pending and rejected ones too, and
 * the grid marks them.
 *
 * The preferences are shown in a sentence rather than as a row of toggles,
 * because the useful question is "who am I being shown" and a list of fields
 * does not answer it. They are read-only here; changing them belongs in the
 * editor, where a change can be saved as one thing.
 */
export function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const profile = useMyProfile();
  const preferences = useMyPreferences();
  const details = useMyProfileDetails();
  const photos = usePhotoUpload();
  const { signOut } = useUseCases();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const goToEdit = useCallback(() => navigation.navigate('EditProfile'), [navigation]);
  const goToBrowse = useCallback(() => navigation.navigate('Browse'), [navigation]);
  const editSection = useCallback(
    (section: ProfileSection) => navigation.navigate('EditProfileSection', { section }),
    [navigation],
  );

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

  const photoNotice = moderationSummary(photos.photos);

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
              <Avatar
                name={person.name}
                uri={photos.photos[0]?.url ?? person.photoUrls[0]}
                size={88}
              />
              <Spacer size={16} />
              <AppText variant="subheading">
                {person.age ? `${person.name}, ${person.age}` : person.name}
              </AppText>
              <AppText variant="body" color="textSecondary" align="center">
                {person.city}
              </AppText>
              {person.headline ? (
                <AppText
                  variant="body"
                  color="textSecondary"
                  align="center"
                  style={{ marginTop: theme.spacing[8] }}
                >
                  {person.headline}
                </AppText>
              ) : null}

              <Spacer size={16} />
              <Badge
                label={VERIFICATION[person.verification].label}
                tone={VERIFICATION[person.verification].tone}
              />

              {person.intents.length > 0 ? (
                <View
                  style={[styles.tags, { marginTop: theme.spacing[16], gap: theme.spacing[8] }]}
                >
                  {person.intents.map((intent) => (
                    <Badge key={intent} label={MEET_INTENT_LABELS[intent]} tone="primary" />
                  ))}
                </View>
              ) : null}

              <Spacer size={20} />
              <Button
                label="Edit profile"
                onPress={goToEdit}
                fullWidth
                testID="button-edit-profile"
              />
            </View>

            <Spacer size={32} />
            <SectionHeader
              title="Photos"
              subtitle="The first one is your avatar everywhere in the app"
            />
            <Spacer size={12} />
            <PhotoGrid
              photos={photos.photos}
              onAdd={() => {
                void photos.add();
              }}
              onRemove={(id) => {
                void photos.remove(id);
              }}
              busy={photos.isBusy}
              canPick={photos.canPick}
            />
            {photos.error ? (
              <>
                <Spacer size={12} />
                <AppText variant="caption" color="danger" testID="profile-photo-error">
                  {photos.error}
                </AppText>
              </>
            ) : photoNotice ? (
              <>
                <Spacer size={12} />
                <AppText variant="caption" color="textSecondary">
                  {photoNotice}
                </AppText>
              </>
            ) : null}

            <Spacer size={32} />
            <SectionHeader title="Who you see" subtitle="Nobody else is told any of this" />
            <Spacer size={12} />
            <QueryBoundary
              isLoading={preferences.isPending}
              error={preferences.error}
              data={preferences.data}
              onRetry={preferences.refetch}
              isEmpty={() => false}
            >
              {(prefs) => <PreferenceSummary preferences={prefs} person={person} />}
            </QueryBoundary>

            <Spacer size={32} />
            <SectionHeader
              title="Your details"
              subtitle="Everything from your profile. Tap Edit to change a section."
            />
            <QueryBoundary
              isLoading={details.isPending}
              error={details.error}
              data={details.data}
              onRetry={details.refetch}
              isEmpty={() => false}
            >
              {(answers) => <YourDetails person={person} details={answers} onEdit={editSection} />}
            </QueryBoundary>

            <Spacer size={32} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse everyone else"
              accessibilityHint="Opens a list of members outside today's three"
              onPress={goToBrowse}
              style={({ pressed }) => [
                styles.linkRow,
                {
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.radii.lg,
                  borderColor: theme.colors.border,
                  padding: theme.spacing[16],
                  gap: theme.spacing[12],
                },
                pressed && styles.pressed,
              ]}
              testID="link-browse"
            >
              <Ionicons name="people-outline" size={22} color={theme.colors.primary} />
              <View style={styles.grow}>
                <AppText variant="bodyStrong">Browse everyone else</AppText>
                <AppText
                  variant="caption"
                  color="textSecondary"
                  style={{ marginTop: theme.spacing[2] }}
                >
                  Have a look around. Liking still only happens in Today.
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textDisabled} />
            </Pressable>

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

/** The category section that asks a missing required answer. */
const SECTION_FOR_FIELD: Partial<Record<keyof ProfileDetails, ProfileSection>> = {
  relationshipGoal: 'Dating',
  marriageTimeline: 'Life partner',
  maritalStatus: 'Life partner',
  cofounderRole: 'Co-founder',
  founderCommitment: 'Co-founder',
  seekingSkills: 'Co-founder',
};

/**
 * The member's own profile, section by section, each one editable.
 *
 * Above it, when the purpose they are here for is missing an answer it
 * requires, a prompt to go and give it. That happens to two kinds of member:
 * everybody who finished onboarding before the purpose questions existed, and
 * anybody who has since added a purpose in the profile editor.
 */
function YourDetails({
  person,
  details,
  onEdit,
}: {
  person: Person;
  details: ProfileDetails;
  onEdit: (section: ProfileSection) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const missing = missingCategoryAnswer(person.intents, details);
  const missingSection = missing ? SECTION_FOR_FIELD[missing.field] : undefined;

  return (
    <>
      {missing && missingSection ? (
        <View
          style={[
            styles.card,
            {
              marginTop: theme.spacing[16],
              backgroundColor: theme.colors.card,
              borderRadius: theme.radii.lg,
              borderColor: theme.colors.warning,
              padding: theme.spacing[16],
            },
          ]}
          testID="category-prompt"
        >
          <AppText variant="bodyStrong">{`Finish your ${missingSection.toLowerCase()} answers`}</AppText>
          <AppText variant="caption" color="textSecondary" style={{ marginTop: theme.spacing[4] }}>
            {missing.message}
          </AppText>
          <Spacer size={12} />
          <Button
            label="Answer now"
            size="sm"
            onPress={() => onEdit(missingSection)}
            testID="button-answer-category"
          />
        </View>
      ) : null}

      <ProfileSummary
        person={person}
        details={details}
        viewer="self"
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
        onEdit={onEdit}
      />
    </>
  );
}

/**
 * The preferences, as sentences.
 *
 * "Ages 24 to 38, in Pune" is read in one glance; `ageMin: 24, ageMax: 38,
 * cities: ["Pune"]` is three fields to assemble in your head. An empty array
 * means "no preference" everywhere in this product (see `Preferences`), so the
 * sentence has to say that in words rather than showing nothing.
 */
function PreferenceSummary({
  preferences,
  person,
}: {
  preferences: Preferences;
  person: Person;
}): React.JSX.Element {
  const theme = useTheme();

  const genders =
    preferences.interestedIn.length === 0
      ? 'Anyone'
      : toSentenceList(
          preferences.interestedIn.map(
            (gender) =>
              GENDER_PLURAL_LABELS[gender as keyof typeof GENDER_PLURAL_LABELS] ?? 'Everyone else',
          ),
        );

  const purposes =
    preferences.intents.length === 0
      ? 'anything'
      : toSentenceList(
          preferences.intents.map((intent) => MEET_INTENT_LABELS[intent].toLowerCase()),
        );

  const cities = preferences.cities.length === 0 ? person.city : toSentenceList(preferences.cities);

  const rows: [keyof typeof Ionicons.glyphMap, string][] = [
    ['people-outline', genders],
    ['sparkles-outline', `Here for ${purposes}`],
    ['calendar-outline', `Ages ${preferences.ageMin} to ${preferences.ageMax}`],
    ['location-outline', `In ${cities}`],
    [
      preferences.pushEnabled ? 'notifications-outline' : 'notifications-off-outline',
      preferences.pushEnabled ? 'Notifications on' : 'Notifications off',
    ],
  ];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.lg,
          borderColor: theme.colors.border,
          paddingHorizontal: theme.spacing[16],
        },
      ]}
    >
      {rows.map(([icon, text], index) => (
        <View
          key={text}
          style={[
            styles.prefRow,
            {
              paddingVertical: theme.spacing[12],
              gap: theme.spacing[12],
              borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <Ionicons name={icon} size={18} color={theme.colors.textSecondary} />
          <AppText variant="body" style={styles.grow}>
            {text}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  // Centred in the hero, where the whole card is centred.
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  // Left-aligned in the body, where everything else starts at the margin —
  // centred tags under left-aligned prose read as a mistake.
  tagsLeft: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { borderWidth: StyleSheet.hairlineWidth },
  prefRow: { flexDirection: 'row', alignItems: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1 },
  pressed: { opacity: 0.85 },
});
