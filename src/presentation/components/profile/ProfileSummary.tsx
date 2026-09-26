import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';
import { ageOn } from '@/domain/usecases';
import {
  CHILDREN_PLAN_LABELS,
  COFOUNDER_ROLE_LABELS,
  DIET_LABELS,
  DRINKING_LABELS,
  EDUCATION_LEVEL_LABELS,
  EXERCISE_LABELS,
  FAMILY_INVOLVEMENT_LABELS,
  FOUNDER_COMMITMENT_LABELS,
  FOUNDER_SKILL_LABELS,
  FUNDING_PLAN_LABELS,
  GENDER_LABELS,
  GENDER_PLURAL_LABELS,
  IMPORTANCE_LABELS,
  LIVING_ARRANGEMENT_LABELS,
  MARITAL_STATUS_LABELS,
  MARRIAGE_TIMELINE_LABELS,
  MAX_PHOTOS,
  MEET_INTENT_EMOJI,
  MEET_INTENT_LABELS,
  OCCUPATION_STATUS_LABELS,
  PARTNER_VALUE_LABELS,
  PET_LABELS,
  PROMPT_LABELS,
  RELATIONSHIP_GOAL_LABELS,
  RELIGION_LABELS,
  RELOCATION_LABELS,
  SLEEP_LABELS,
  SMOKING_LABELS,
  STARTUP_STAGE_LABELS,
  STUDY_MODE_LABELS,
  WORK_MODE_LABELS,
  isRomanticIntent,
  isStudying,
  isWorking,
  type HideableField,
  type Person,
  type Preferences,
  type ProfileDetails,
} from '@/domain/entities';

/**
 * A profile, section by section — the one rendering used everywhere a profile
 * is read in full.
 *
 * Three places show it, and they must agree about what an answer looks like:
 * the preview at the end of onboarding, the member's own Profile tab, and
 * another member's profile. Before this existed the preview had its own copy,
 * and a second and third copy would have drifted apart within a release.
 *
 * WHAT DIFFERS BY VIEWER
 * - `self` shows every section, empty ones included ("Nothing added yet"), and
 *   marks hidden answers "(only you)" so the member can see they were kept.
 * - `other` shows only sections with something in them, never preferences,
 *   and never labels anything hidden — the server has already removed hidden
 *   answers and other purposes' answers before they reach the phone (see
 *   `profile_details_for()`), so there is nothing to label.
 *
 * Section names are the onboarding steps' `section` values, so a caller can
 * turn an Edit tap straight into "the steps of that section".
 */

export type ProfileSection =
  | 'Purpose'
  | 'Basics'
  | 'Location'
  | 'Education & work'
  | 'Lifestyle'
  | 'Dating'
  | 'Life partner'
  | 'Co-founder'
  | 'About you'
  | 'Photos'
  | 'Preferences';

export type ProfileSummaryProps = {
  person: Person;
  /** Null when nothing is shared — another member with no common profile yet. */
  details: ProfileDetails | null;
  viewer: 'self' | 'other';
  /** The member's own preferences. Shown only to themselves. */
  preferences?: Preferences;
  /** Shows a Photos row when given. */
  photoCount?: number;
  /** Which sections to show. Defaults to every one that applies. */
  sections?: readonly ProfileSection[];
  /** Adds an Edit link to each section in `editable` (all, by default). */
  onEdit?: (section: ProfileSection) => void;
  editable?: readonly ProfileSection[];
};

const ALL_SECTIONS: readonly ProfileSection[] = [
  'Purpose',
  'Basics',
  'Location',
  'Education & work',
  'Lifestyle',
  'Dating',
  'Life partner',
  'Co-founder',
  'About you',
  'Photos',
  'Preferences',
];

type Row = [string, string];

export function ProfileSummary({
  person,
  details,
  viewer,
  preferences,
  photoCount,
  sections = ALL_SECTIONS,
  onEdit,
  editable = ALL_SECTIONS,
}: ProfileSummaryProps): React.JSX.Element {
  const self = viewer === 'self';
  const hidden = new Set<HideableField>(details?.hiddenFields ?? []);
  const intents = person.intents;
  const age = person.dateOfBirth ? ageOn(new Date(person.dateOfBirth), new Date()) : person.age;

  const privately = (value: string | undefined, field: HideableField): string | undefined =>
    value && self && hidden.has(field) ? `${value} (only you)` : value;

  const rows = (entries: [string, string | undefined | false | null][]): Row[] =>
    entries.filter((entry): entry is Row => Boolean(entry[1]));

  const d = details;

  const content: Record<ProfileSection, Row[] | null> = {
    Purpose: rows([
      [
        'Looking for',
        intents
          .map((intent) => `${MEET_INTENT_EMOJI[intent]} ${MEET_INTENT_LABELS[intent]}`)
          .join(', '),
      ],
    ]),
    Basics: rows([
      // Another member's name and age are already in the card above; the
      // surname appears only if they chose to show it.
      [
        'Name',
        self
          ? [person.name, privately(d?.lastName, 'lastName')].filter(Boolean).join(' ')
          : d?.lastName && `${person.name} ${d.lastName}`,
      ],
      ['Age', self && age !== undefined ? String(age) : undefined],
      ['Gender', person.gender ? GENDER_LABELS[person.gender] : undefined],
      ['Pronouns', d?.pronouns],
      [
        'Interested in',
        self &&
          preferences &&
          intents.some((intent) => isRomanticIntent(intent)) &&
          preferences.interestedIn.length > 0 &&
          `${preferences.interestedIn
            .map(
              (gender) =>
                GENDER_PLURAL_LABELS[gender as keyof typeof GENDER_PLURAL_LABELS] ?? gender,
            )
            .join(', ')} (only you)`,
      ],
    ]),
    Location: rows([
      ['Lives in', person.city],
      ['Hometown', privately(d?.hometown, 'hometown')],
      ['Speaks', d?.languages.join(', ')],
    ]),
    'Education & work': rows([
      ['Currently', d?.occupationStatus && OCCUPATION_STATUS_LABELS[d.occupationStatus]],
      ['Education', d?.educationLevel && EDUCATION_LEVEL_LABELS[d.educationLevel]],
      ['College', privately(d?.institution, 'institution')],
      ['Studied', [d?.degree, d?.fieldOfStudy].filter(Boolean).join(', ')],
      [isStudying(d?.occupationStatus) ? 'Graduating' : 'Graduated', d?.graduationYear?.toString()],
      ['Studies', d?.studyMode && STUDY_MODE_LABELS[d.studyMode]],
      ['Work', isWorking(d?.occupationStatus) ? (d?.jobTitle ?? d?.occupation) : undefined],
      ['Company', privately(d?.company, 'company')],
      ['Works from', privately(d?.workLocation, 'workLocation')],
      ['Work style', d?.workMode && WORK_MODE_LABELS[d.workMode]],
    ]),
    Lifestyle: rows([
      ['Smoking', d?.smoking && SMOKING_LABELS[d.smoking]],
      ['Drinking', d?.drinking && DRINKING_LABELS[d.drinking]],
      ['Food', d?.diet && DIET_LABELS[d.diet]],
      ['Exercise', d?.exercise && EXERCISE_LABELS[d.exercise]],
      ['Sleep', d?.sleep && SLEEP_LABELS[d.sleep]],
      ['Pets', d?.pets && PET_LABELS[d.pets]],
    ]),
    Dating: intents.includes('dating')
      ? rows([
          ['Looking for', d?.relationshipGoal && RELATIONSHIP_GOAL_LABELS[d.relationshipGoal]],
          ['Children', d?.childrenPlan && CHILDREN_PLAN_LABELS[d.childrenPlan]],
          ['Values', d?.partnerValues.map((value) => PARTNER_VALUE_LABELS[value]).join(', ')],
        ])
      : null,
    'Life partner': intents.includes('life_partner')
      ? rows([
          ['Marriage', d?.marriageTimeline && MARRIAGE_TIMELINE_LABELS[d.marriageTimeline]],
          ['Status', d?.maritalStatus && MARITAL_STATUS_LABELS[d.maritalStatus]],
          ['Children', d?.childrenPlan && CHILDREN_PLAN_LABELS[d.childrenPlan]],
          ['Religion', privately(d?.religion && RELIGION_LABELS[d.religion], 'religion')],
          ['Shared faith', d?.faithImportance && IMPORTANCE_LABELS[d.faithImportance]],
          ['Living', d?.livingArrangement && LIVING_ARRANGEMENT_LABELS[d.livingArrangement]],
          ['Family', d?.familyInvolvement && FAMILY_INVOLVEMENT_LABELS[d.familyInvolvement]],
          ['Relocate', d?.openToRelocate && RELOCATION_LABELS[d.openToRelocate]],
        ])
      : null,
    'Co-founder': intents.includes('co_founder')
      ? rows([
          ['Role', d?.cofounderRole && COFOUNDER_ROLE_LABELS[d.cofounderRole]],
          ['Stage', d?.startupStage && STARTUP_STAGE_LABELS[d.startupStage]],
          ['Strengths', d?.founderSkills.map((skill) => FOUNDER_SKILL_LABELS[skill]).join(', ')],
          ['Time', d?.founderCommitment && FOUNDER_COMMITMENT_LABELS[d.founderCommitment]],
          ['Needs', d?.seekingSkills.map((skill) => FOUNDER_SKILL_LABELS[skill]).join(', ')],
          ['Industries', d?.startupIndustries.join(', ')],
          ['Funding', d?.fundingPlan && FUNDING_PLAN_LABELS[d.fundingPlan]],
        ])
      : null,
    'About you': rows([
      ['Interests', person.interests.join(', ')],
      ['Intro', person.bio],
      ['Line', person.headline],
      ...(d?.prompts ?? []).map((prompt): [string, string] => [
        PROMPT_LABELS[prompt.key],
        prompt.answer,
      ]),
    ]),
    Photos:
      photoCount === undefined
        ? null
        : rows([['Photos', photoCount > 0 && `${photoCount} of ${MAX_PHOTOS}`]]),
    Preferences:
      self && preferences
        ? rows([['Ages', `${preferences.ageMin}–${preferences.ageMax} (only you)`]])
        : null,
  };

  return (
    <View testID={`profile-summary-${viewer}`}>
      {sections.map((section) => {
        const lines = content[section];
        // Null: the section does not apply here at all (another purpose's
        // questions, preferences seen by somebody else). Empty: it applies
        // and is unanswered — worth saying to the member, noise to others.
        if (lines === null) return null;
        if (!self && lines.length === 0) return null;

        return (
          <Section
            key={section}
            title={section}
            rows={lines}
            {...(onEdit && editable.includes(section) ? { onEdit: () => onEdit(section) } : {})}
          />
        );
      })}
    </View>
  );
}

function Section({
  title,
  rows,
  onEdit,
}: {
  title: string;
  rows: Row[];
  onEdit?: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ marginTop: theme.spacing[24] }}>
      <View style={styles.row}>
        <AppText variant="bodyStrong" style={styles.grow}>
          {title}
        </AppText>
        {onEdit ? (
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
        ) : null}
      </View>
      <View style={{ marginTop: theme.spacing[8], gap: theme.spacing[4] }}>
        {rows.length === 0 ? (
          <AppText variant="caption" color="textDisabled">
            Nothing added yet.
          </AppText>
        ) : (
          rows.map(([label, value]) => (
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
  grow: { flex: 1 },
  label: { width: 96 },
});
