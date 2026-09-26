import React from 'react';
import { View } from 'react-native';

import {
  AppText,
  ChoiceRow,
  InterestPicker,
  MultiOptionChips,
  OptionChips,
  VisibilityToggle,
} from '@/presentation/components';
import { useTheme } from '@/presentation/hooks/useTheme';
import {
  CHILDREN_PLANS,
  CHILDREN_PLAN_LABELS,
  COFOUNDER_ROLES,
  COFOUNDER_ROLE_LABELS,
  FAMILY_INVOLVEMENTS,
  FAMILY_INVOLVEMENT_LABELS,
  FOUNDER_COMMITMENTS,
  FOUNDER_COMMITMENT_LABELS,
  FOUNDER_SKILLS,
  FOUNDER_SKILL_LABELS,
  FUNDING_PLANS,
  FUNDING_PLAN_LABELS,
  IMPORTANCE_LABELS,
  IMPORTANCE_LEVELS,
  LIVING_ARRANGEMENTS,
  LIVING_ARRANGEMENT_LABELS,
  MARITAL_STATUSES,
  MARITAL_STATUS_LABELS,
  MARRIAGE_TIMELINES,
  MARRIAGE_TIMELINE_LABELS,
  PARTNER_VALUES,
  PARTNER_VALUE_LABELS,
  RELATIONSHIP_GOALS,
  RELATIONSHIP_GOAL_LABELS,
  RELIGIONS,
  RELIGION_LABELS,
  RELOCATION_LABELS,
  RELOCATION_OPTIONS,
  STARTUP_STAGES,
  STARTUP_STAGE_LABELS,
} from '@/domain/entities';
import { ONBOARDING_LIMITS } from '@/domain/usecases';
import { SUGGESTED_STARTUP_INDUSTRIES } from '@/shared/constants/app';
import type { StepContext } from '../steps';

/**
 * The questions that depend on what the member is here for.
 *
 * Two short steps per purpose, and almost everything is a tap: somebody on
 * their phone will answer six chip questions and abandon one text box.
 * Which of these a purpose requires is decided in one place for the phone
 * (`missingCategoryAnswer`) and one for the server (`complete_my_onboarding`).
 */

/* ----------------------------------------------------------------- dating -- */

export function DatingGoalBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[12] }}>
      {RELATIONSHIP_GOALS.map((goal) => (
        <ChoiceRow
          key={goal}
          label={RELATIONSHIP_GOAL_LABELS[goal]}
          selected={draft.relationshipGoal === goal}
          onPress={() => patch({ relationshipGoal: goal })}
          testID={`choice-goal-${goal}`}
        />
      ))}
    </View>
  );
}

export function DatingMoreBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[24] }}>
      <OptionChips
        label="Children"
        optional
        options={CHILDREN_PLANS}
        labels={CHILDREN_PLAN_LABELS}
        value={draft.childrenPlan}
        onChange={(childrenPlan) => patch({ childrenPlan })}
        testID="option-children"
      />
      <MultiOptionChips
        label="What matters most in a partner"
        optional
        options={PARTNER_VALUES}
        labels={PARTNER_VALUE_LABELS}
        values={draft.partnerValues}
        max={ONBOARDING_LIMITS.partnerValues.max}
        onChange={(partnerValues) => patch({ partnerValues })}
        testID="option-partner-values"
      />
    </View>
  );
}

/* ----------------------------------------------------------- life partner -- */

export function MarriageBasicsBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[24] }}>
      <OptionChips
        label="When would you like to get married?"
        options={MARRIAGE_TIMELINES}
        labels={MARRIAGE_TIMELINE_LABELS}
        value={draft.marriageTimeline}
        onChange={(marriageTimeline) => patch({ marriageTimeline })}
        testID="option-marriage-timeline"
      />
      <OptionChips
        label="Marital status"
        options={MARITAL_STATUSES}
        labels={MARITAL_STATUS_LABELS}
        value={draft.maritalStatus}
        onChange={(maritalStatus) => patch({ maritalStatus })}
        testID="option-marital-status"
      />
    </View>
  );
}

export function FamilyFaithBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  const religionAnswered = draft.religion !== null && draft.religion !== 'prefer_not_to_say';

  return (
    <View style={{ gap: theme.spacing[24] }}>
      <OptionChips
        label="Children"
        optional
        options={CHILDREN_PLANS}
        labels={CHILDREN_PLAN_LABELS}
        value={draft.childrenPlan}
        onChange={(childrenPlan) => patch({ childrenPlan })}
        testID="option-children"
      />
      <View>
        <OptionChips
          label="Religion"
          optional
          options={RELIGIONS}
          labels={RELIGION_LABELS}
          value={draft.religion}
          onChange={(religion) => patch({ religion })}
          testID="option-religion"
        />
        {religionAnswered ? (
          <VisibilityToggle
            shown={draft.showReligion}
            onChange={(showReligion) => patch({ showReligion })}
            subject="your religion"
            testID="toggle-show-religion"
          />
        ) : null}
      </View>
      <OptionChips
        label="How important is shared faith?"
        optional
        options={IMPORTANCE_LEVELS}
        labels={IMPORTANCE_LABELS}
        value={draft.faithImportance}
        onChange={(faithImportance) => patch({ faithImportance })}
        testID="option-faith-importance"
      />
      <OptionChips
        label="After marriage, living"
        optional
        options={LIVING_ARRANGEMENTS}
        labels={LIVING_ARRANGEMENT_LABELS}
        value={draft.livingArrangement}
        onChange={(livingArrangement) => patch({ livingArrangement })}
        testID="option-living"
      />
      <OptionChips
        label="Family involvement"
        optional
        options={FAMILY_INVOLVEMENTS}
        labels={FAMILY_INVOLVEMENT_LABELS}
        value={draft.familyInvolvement}
        onChange={(familyInvolvement) => patch({ familyInvolvement })}
        testID="option-family-involvement"
      />
      <OptionChips
        label="Open to relocating?"
        optional
        options={RELOCATION_OPTIONS}
        labels={RELOCATION_LABELS}
        value={draft.openToRelocate}
        onChange={(openToRelocate) => patch({ openToRelocate })}
        testID="option-relocate"
      />
    </View>
  );
}

/* ------------------------------------------------------------- co-founder -- */

export function FounderSideBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[24] }}>
      <View style={{ gap: theme.spacing[12] }}>
        {COFOUNDER_ROLES.map((role) => (
          <ChoiceRow
            key={role}
            label={COFOUNDER_ROLE_LABELS[role]}
            selected={draft.cofounderRole === role}
            // The stage is only asked of somebody with a startup; moving
            // away from that answer clears it rather than keeping a stage
            // for a startup they have just said they do not have.
            onPress={() =>
              patch({
                cofounderRole: role,
                ...(role === 'have_startup' ? {} : { startupStage: null }),
              })
            }
            testID={`choice-cofounder-role-${role}`}
          />
        ))}
      </View>

      {draft.cofounderRole === 'have_startup' ? (
        <OptionChips
          label="What stage is it at?"
          optional
          options={STARTUP_STAGES}
          labels={STARTUP_STAGE_LABELS}
          value={draft.startupStage}
          onChange={(startupStage) => patch({ startupStage })}
          testID="option-startup-stage"
        />
      ) : null}

      <MultiOptionChips
        label="Your strengths"
        optional
        options={FOUNDER_SKILLS}
        labels={FOUNDER_SKILL_LABELS}
        values={draft.founderSkills}
        max={ONBOARDING_LIMITS.founderSkills.max}
        onChange={(founderSkills) => patch({ founderSkills })}
        testID="option-founder-skills"
      />

      <OptionChips
        label="How much time can you give it?"
        options={FOUNDER_COMMITMENTS}
        labels={FOUNDER_COMMITMENT_LABELS}
        value={draft.founderCommitment}
        onChange={(founderCommitment) => patch({ founderCommitment })}
        testID="option-commitment"
      />
    </View>
  );
}

export function FounderSeekingBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[24] }}>
      <MultiOptionChips
        label="Strengths you need in a co-founder"
        options={FOUNDER_SKILLS}
        labels={FOUNDER_SKILL_LABELS}
        values={draft.seekingSkills}
        max={ONBOARDING_LIMITS.seekingSkills.max}
        onChange={(seekingSkills) => patch({ seekingSkills })}
        testID="option-seeking-skills"
      />

      <View>
        <AppText variant="label" color="textSecondary">
          Industries
          <AppText variant="caption" color="textDisabled">
            {'  Optional'}
          </AppText>
        </AppText>
        <View style={{ marginTop: theme.spacing[8] }}>
          <InterestPicker
            selected={draft.startupIndustries}
            onChange={(startupIndustries) => patch({ startupIndustries })}
            min={0}
            max={ONBOARDING_LIMITS.startupIndustries.max}
            suggestions={SUGGESTED_STARTUP_INDUSTRIES}
            customLabel="Another industry"
            customPlaceholder="Spacetech…"
            testIDPrefix="industry"
          />
        </View>
      </View>

      <OptionChips
        label="Funding"
        optional
        options={FUNDING_PLANS}
        labels={FUNDING_PLAN_LABELS}
        value={draft.fundingPlan}
        onChange={(fundingPlan) => patch({ fundingPlan })}
        testID="option-funding"
      />
    </View>
  );
}
