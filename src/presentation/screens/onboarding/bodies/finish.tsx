import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { AgeRangeField, AppText, ChoiceRow, Spacer } from '@/presentation/components';
import {
  useMyPhotos,
  useMyPreferences,
  useMyProfile,
  useMyProfileDetails,
} from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
import {
  DIET_LABELS,
  DRINKING_LABELS,
  EDUCATION_LEVEL_LABELS,
  EXERCISE_LABELS,
  GENDER_LABELS,
  GENDER_PLURAL_LABELS,
  MAX_AGE,
  MAX_PHOTOS,
  MEET_INTENT_EMOJI,
  MEET_INTENT_LABELS,
  MIN_AGE,
  OCCUPATION_STATUS_LABELS,
  PET_LABELS,
  PROMPT_LABELS,
  SLEEP_LABELS,
  SMOKING_LABELS,
  STUDY_MODE_LABELS,
  WORK_MODE_LABELS,
  CHILDREN_PLAN_LABELS,
  COFOUNDER_ROLE_LABELS,
  FAMILY_INVOLVEMENT_LABELS,
  FOUNDER_COMMITMENT_LABELS,
  FOUNDER_SKILL_LABELS,
  FUNDING_PLAN_LABELS,
  IMPORTANCE_LABELS,
  LIVING_ARRANGEMENT_LABELS,
  MARITAL_STATUS_LABELS,
  MARRIAGE_TIMELINE_LABELS,
  PARTNER_VALUE_LABELS,
  RELATIONSHIP_GOAL_LABELS,
  RELIGION_LABELS,
  RELOCATION_LABELS,
  STARTUP_STAGE_LABELS,
  isRomanticIntent,
  isStudying,
  isWorking,
  profileCompleteness,
  usablePhotos,
} from '@/domain/entities';
import { ageOn } from '@/domain/usecases';
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
export function PreviewBody({ goTo }: StepContext): React.JSX.Element {
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
  const hidden = new Set(details.hiddenFields);
  const age = person.dateOfBirth ? ageOn(new Date(person.dateOfBirth), new Date()) : person.age;
  const intents = person.intents;
  const stale = profile.isError || detailsQuery.isError || preferencesQuery.isError;

  const privately = (
    value: string | undefined,
    field: (typeof details.hiddenFields)[number],
  ): string | undefined =>
    value ? (hidden.has(field) ? `${value} (only you)` : value) : undefined;

  const lines = (entries: [string, string | undefined][]): [string, string][] =>
    entries.filter((entry): entry is [string, string] => Boolean(entry[1]));

  const lifestyle = lines([
    ['Smoking', details.smoking && SMOKING_LABELS[details.smoking]],
    ['Drinking', details.drinking && DRINKING_LABELS[details.drinking]],
    ['Food', details.diet && DIET_LABELS[details.diet]],
    ['Exercise', details.exercise && EXERCISE_LABELS[details.exercise]],
    ['Sleep', details.sleep && SLEEP_LABELS[details.sleep]],
    ['Pets', details.pets && PET_LABELS[details.pets]],
  ]);

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
        style={[
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.lg,
            padding: theme.spacing[16],
          },
        ]}
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

      <Section title="Purpose" onEdit={() => goTo('purpose')}>
        {lines([
          [
            'Looking for',
            intents
              .map((intent) => `${MEET_INTENT_EMOJI[intent]} ${MEET_INTENT_LABELS[intent]}`)
              .join(', ') || undefined,
          ],
        ])}
      </Section>

      <Section title="Basics" onEdit={() => goTo('name')}>
        {lines([
          [
            'Name',
            [person.name, privately(details.lastName, 'lastName')].filter(Boolean).join(' '),
          ],
          ['Age', age !== undefined ? String(age) : undefined],
          ['Gender', person.gender ? GENDER_LABELS[person.gender] : undefined],
          ['Pronouns', details.pronouns],
          [
            'Interested in',
            intents.some((intent) => isRomanticIntent(intent)) &&
            preferences.interestedIn.length > 0
              ? `${preferences.interestedIn
                  .map(
                    (gender) =>
                      GENDER_PLURAL_LABELS[gender as keyof typeof GENDER_PLURAL_LABELS] ?? gender,
                  )
                  .join(', ')} (only you)`
              : undefined,
          ],
        ])}
      </Section>

      <Section title="Location" onEdit={() => goTo('location')}>
        {lines([
          ['Lives in', person.city],
          ['Hometown', privately(details.hometown, 'hometown')],
          ['Speaks', details.languages.join(', ') || undefined],
        ])}
      </Section>

      <Section title="Education & work" onEdit={() => goTo('status')}>
        {lines([
          [
            'Currently',
            details.occupationStatus && OCCUPATION_STATUS_LABELS[details.occupationStatus],
          ],
          ['Education', details.educationLevel && EDUCATION_LEVEL_LABELS[details.educationLevel]],
          ['College', privately(details.institution, 'institution')],
          [
            'Studied',
            [details.degree, details.fieldOfStudy].filter(Boolean).join(', ') || undefined,
          ],
          [
            isStudying(details.occupationStatus) ? 'Graduating' : 'Graduated',
            details.graduationYear?.toString(),
          ],
          ['Studies', details.studyMode && STUDY_MODE_LABELS[details.studyMode]],
          [
            'Work',
            isWorking(details.occupationStatus)
              ? (details.jobTitle ?? details.occupation)
              : undefined,
          ],
          ['Company', privately(details.company, 'company')],
          ['Works from', privately(details.workLocation, 'workLocation')],
          ['Work style', details.workMode && WORK_MODE_LABELS[details.workMode]],
        ])}
      </Section>

      <Section title="Lifestyle" onEdit={() => goTo('lifestyle')}>
        {lifestyle}
      </Section>

      {intents.includes('dating') ? (
        <Section title="Dating" onEdit={() => goTo('datingGoal')}>
          {lines([
            [
              'Looking for',
              details.relationshipGoal && RELATIONSHIP_GOAL_LABELS[details.relationshipGoal],
            ],
            ['Children', details.childrenPlan && CHILDREN_PLAN_LABELS[details.childrenPlan]],
            [
              'Values',
              details.partnerValues.map((value) => PARTNER_VALUE_LABELS[value]).join(', ') ||
                undefined,
            ],
          ])}
        </Section>
      ) : null}

      {intents.includes('life_partner') ? (
        <Section title="Life partner" onEdit={() => goTo('marriageBasics')}>
          {lines([
            [
              'Marriage',
              details.marriageTimeline && MARRIAGE_TIMELINE_LABELS[details.marriageTimeline],
            ],
            ['Status', details.maritalStatus && MARITAL_STATUS_LABELS[details.maritalStatus]],
            ['Children', details.childrenPlan && CHILDREN_PLAN_LABELS[details.childrenPlan]],
            [
              'Religion',
              privately(details.religion && RELIGION_LABELS[details.religion], 'religion'),
            ],
            ['Shared faith', details.faithImportance && IMPORTANCE_LABELS[details.faithImportance]],
            [
              'Living',
              details.livingArrangement && LIVING_ARRANGEMENT_LABELS[details.livingArrangement],
            ],
            [
              'Family',
              details.familyInvolvement && FAMILY_INVOLVEMENT_LABELS[details.familyInvolvement],
            ],
            ['Relocate', details.openToRelocate && RELOCATION_LABELS[details.openToRelocate]],
          ])}
        </Section>
      ) : null}

      {intents.includes('co_founder') ? (
        <Section title="Co-founder" onEdit={() => goTo('founderSide')}>
          {lines([
            ['Role', details.cofounderRole && COFOUNDER_ROLE_LABELS[details.cofounderRole]],
            ['Stage', details.startupStage && STARTUP_STAGE_LABELS[details.startupStage]],
            [
              'Strengths',
              details.founderSkills.map((skill) => FOUNDER_SKILL_LABELS[skill]).join(', ') ||
                undefined,
            ],
            [
              'Time',
              details.founderCommitment && FOUNDER_COMMITMENT_LABELS[details.founderCommitment],
            ],
            [
              'Needs',
              details.seekingSkills.map((skill) => FOUNDER_SKILL_LABELS[skill]).join(', ') ||
                undefined,
            ],
            ['Industries', details.startupIndustries.join(', ') || undefined],
            ['Funding', details.fundingPlan && FUNDING_PLAN_LABELS[details.fundingPlan]],
          ])}
        </Section>
      ) : null}

      <Section title="About you" onEdit={() => goTo('interests')}>
        {lines([
          ['Interests', person.interests.join(', ') || undefined],
          ['Intro', person.bio],
          ['Line', person.headline || undefined],
          ...details.prompts.map((prompt): [string, string] => [
            PROMPT_LABELS[prompt.key],
            prompt.answer,
          ]),
        ])}
      </Section>

      <Section title="Photos" onEdit={() => goTo('photos')}>
        {lines([['Photos', usable.length > 0 ? `${usable.length} of ${MAX_PHOTOS}` : undefined]])}
      </Section>
      {usable.length > 0 ? (
        <View style={[styles.photos, { gap: theme.spacing[8], marginTop: theme.spacing[8] }]}>
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

      <Section title="Preferences" onEdit={() => goTo('preferences')}>
        {lines([['Ages', `${preferences.ageMin}–${preferences.ageMax} (only you)`]])}
      </Section>
    </>
  );
}

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: [string, string][];
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ marginTop: theme.spacing[24] }}>
      <View style={styles.row}>
        <AppText variant="bodyStrong" style={styles.grow}>
          {title}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${title}`}
          onPress={onEdit}
          hitSlop={theme.hitSlop}
          testID={`button-edit-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`}
        >
          <AppText variant="label" color="primary">
            Edit
          </AppText>
        </Pressable>
      </View>
      <View style={{ marginTop: theme.spacing[8], gap: theme.spacing[4] }}>
        {children.length === 0 ? (
          <AppText variant="caption" color="textDisabled">
            Nothing added yet.
          </AppText>
        ) : (
          children.map(([label, value]) => (
            <View key={label} style={[styles.row, { gap: theme.spacing[12] }]}>
              <AppText variant="caption" color="textSecondary" style={styles.label}>
                {label}
              </AppText>
              <AppText variant="body" style={styles.grow}>
                {value}
              </AppText>
            </View>
          ))
        )}
      </View>
    </View>
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
