import React from 'react';
import { View } from 'react-native';

import {
  AppText,
  Chip,
  ChipGroup,
  ChoiceRow,
  InterestPicker,
  OptionChips,
  Spacer,
  TextField,
  VisibilityToggle,
} from '@/presentation/components';
import { useTheme } from '@/presentation/hooks/useTheme';
import {
  DIETS,
  DIET_LABELS,
  DRINKING_HABITS,
  DRINKING_LABELS,
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
  EXERCISE_HABITS,
  EXERCISE_LABELS,
  OCCUPATION_STATUSES,
  OCCUPATION_STATUS_LABELS,
  PET_LABELS,
  PET_PREFERENCES,
  SLEEP_LABELS,
  SLEEP_SCHEDULES,
  SMOKING_HABITS,
  SMOKING_LABELS,
  STUDY_MODES,
  STUDY_MODE_LABELS,
  WORK_MODES,
  WORK_MODE_LABELS,
  isStudying,
} from '@/domain/entities';
import { ONBOARDING_LIMITS } from '@/domain/usecases';
import {
  SUGGESTED_CAREER_INTERESTS,
  SUGGESTED_INDUSTRIES,
  SUGGESTED_SKILLS,
} from '@/shared/constants/app';
import { isWholeNumberOrBlank } from '../draft';
import type { StepContext } from '../steps';

/* ----------------------------------------------------------------- status -- */

export function StatusBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[12] }}>
      {OCCUPATION_STATUSES.map((status) => (
        <ChoiceRow
          key={status}
          label={OCCUPATION_STATUS_LABELS[status]}
          selected={draft.occupationStatus === status}
          onPress={() => patch({ occupationStatus: status })}
          testID={`choice-status-${status}`}
        />
      ))}
    </View>
  );
}

/* -------------------------------------------------------------- education -- */

/**
 * Education, which for a student is what they are studying now.
 *
 * One set of fields rather than an "education" step and a "studies" step
 * that both ask for a college, a degree and a subject. The labels change
 * instead, and the student step that follows asks only what is left.
 */
export function EducationBody({ draft, patch }: StepContext): React.JSX.Element {
  const studying = isStudying(draft.occupationStatus ?? undefined);
  const yearInvalid = !isWholeNumberOrBlank(draft.graduationYear);

  return (
    <>
      <OptionChips
        label={studying ? 'What are you studying for?' : 'Highest level'}
        optional
        options={EDUCATION_LEVELS}
        labels={EDUCATION_LEVEL_LABELS}
        value={draft.educationLevel}
        onChange={(educationLevel) => patch({ educationLevel })}
        testID="option-education-level"
      />

      {draft.educationLevel === 'prefer_not_to_say' ? null : (
        <>
          <Spacer size={24} />
          <TextField
            label="College or university (optional)"
            value={draft.institution}
            onChangeText={(institution) => patch({ institution })}
            placeholder="Fergusson College"
            autoCapitalize="words"
            maxLength={ONBOARDING_LIMITS.longText.max}
            testID="input-institution"
          />
          {draft.institution.trim() ? (
            <VisibilityToggle
              shown={draft.showInstitution}
              onChange={(showInstitution) => patch({ showInstitution })}
              subject="your college"
              testID="toggle-show-institution"
            />
          ) : null}
          <Spacer size={16} />
          <TextField
            label="Degree or course (optional)"
            value={draft.degree}
            onChangeText={(degree) => patch({ degree })}
            placeholder="B.Tech"
            autoCapitalize="words"
            maxLength={ONBOARDING_LIMITS.longText.max}
            testID="input-degree"
          />
          <Spacer size={16} />
          <TextField
            label={studying ? 'Specialisation (optional)' : 'Field of study (optional)'}
            value={draft.fieldOfStudy}
            onChangeText={(fieldOfStudy) => patch({ fieldOfStudy })}
            placeholder="Computer science"
            autoCapitalize="sentences"
            maxLength={ONBOARDING_LIMITS.longText.max}
            testID="input-field-of-study"
          />
          <Spacer size={16} />
          <TextField
            label={studying ? 'Expected graduation year (optional)' : 'Graduation year (optional)'}
            value={draft.graduationYear}
            onChangeText={(graduationYear) => patch({ graduationYear })}
            placeholder={studying ? '2027' : '2019'}
            keyboardType="number-pad"
            maxLength={4}
            error={yearInvalid ? 'Just the year, in numbers.' : undefined}
            testID="input-graduation-year"
          />
        </>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- student -- */

export function StudiesBody({ draft, patch }: StepContext): React.JSX.Element {
  const yearInvalid = !isWholeNumberOrBlank(draft.studyYear);

  return (
    <>
      <TextField
        label="Which year are you in? (optional)"
        value={draft.studyYear}
        onChangeText={(studyYear) => patch({ studyYear })}
        placeholder="2"
        keyboardType="number-pad"
        maxLength={2}
        error={yearInvalid ? 'A number, like 2.' : undefined}
        testID="input-study-year"
      />
      <Spacer size={16} />
      <OptionChips
        label="Full-time or part-time?"
        optional
        options={STUDY_MODES}
        labels={STUDY_MODE_LABELS}
        value={draft.studyMode}
        onChange={(studyMode) => patch({ studyMode })}
        testID="option-study-mode"
      />
      <Spacer size={16} />
      <TextField
        label="Previous education (optional)"
        value={draft.previousEducation}
        onChangeText={(previousEducation) => patch({ previousEducation })}
        placeholder="Diploma in mechanical engineering"
        autoCapitalize="sentences"
        maxLength={ONBOARDING_LIMITS.previousEducation.max}
        testID="input-previous-education"
      />
      <Spacer size={16} />
      <TextField
        label="Internship or job (optional)"
        value={draft.internship}
        onChangeText={(internship) => patch({ internship })}
        placeholder="Summer intern at a design studio"
        autoCapitalize="sentences"
        maxLength={ONBOARDING_LIMITS.longText.max}
        testID="input-internship"
      />

      <Spacer size={32} />
      <AppText variant="bodyStrong">Career interests</AppText>
      <Spacer size={8} />
      <InterestPicker
        selected={draft.careerInterests}
        onChange={(careerInterests) => patch({ careerInterests })}
        min={0}
        max={ONBOARDING_LIMITS.careerInterests.max}
        suggestions={SUGGESTED_CAREER_INTERESTS}
        customLabel="Something else"
        customPlaceholder="Urban planning…"
        testIDPrefix="career"
      />

      <Spacer size={32} />
      <AppText variant="bodyStrong">Skills</AppText>
      <Spacer size={8} />
      <InterestPicker
        selected={draft.skills}
        onChange={(skills) => patch({ skills })}
        min={0}
        max={ONBOARDING_LIMITS.skills.max}
        suggestions={SUGGESTED_SKILLS}
        customLabel="Another skill"
        customPlaceholder="Figma, Excel…"
        testIDPrefix="skill"
      />
    </>
  );
}

/* ------------------------------------------------------------------- work -- */

export function WorkBody({ draft, patch }: StepContext): React.JSX.Element {
  const yearsInvalid = !isWholeNumberOrBlank(draft.yearsExperience);

  return (
    <>
      <TextField
        label="Job title (optional)"
        value={draft.jobTitle}
        onChangeText={(jobTitle) => patch({ jobTitle })}
        placeholder="Product designer"
        autoCapitalize="words"
        maxLength={ONBOARDING_LIMITS.shortText.max}
        testID="input-job-title"
      />
      <Spacer size={16} />
      <TextField
        label="Occupation (optional)"
        value={draft.occupation}
        onChangeText={(occupation) => patch({ occupation })}
        placeholder="Designer, doctor, founder…"
        autoCapitalize="words"
        maxLength={ONBOARDING_LIMITS.shortText.max}
        hint="The broad kind of work, if the title doesn’t say it."
        testID="input-occupation"
      />
      <Spacer size={16} />
      <TextField
        label="Company (optional)"
        value={draft.company}
        onChangeText={(company) => patch({ company })}
        placeholder="Where you work"
        autoCapitalize="words"
        maxLength={ONBOARDING_LIMITS.longText.max}
        testID="input-company"
      />
      {draft.company.trim() ? (
        <VisibilityToggle
          shown={draft.showCompany}
          onChange={(showCompany) => patch({ showCompany })}
          subject="your company"
          testID="toggle-show-company"
        />
      ) : null}
      <Spacer size={16} />
      <TextField
        label="Industry (optional)"
        value={draft.industry}
        onChangeText={(industry) => patch({ industry })}
        placeholder="Technology"
        autoCapitalize="words"
        maxLength={ONBOARDING_LIMITS.shortText.max}
        testID="input-industry"
      />
      <Spacer size={8} />
      <ChipGroup>
        {SUGGESTED_INDUSTRIES.map((industry) => (
          <Chip
            key={industry}
            label={industry}
            selected={draft.industry.trim() === industry}
            onPress={() => patch({ industry: draft.industry.trim() === industry ? '' : industry })}
            testID={`chip-industry-${industry}`}
          />
        ))}
      </ChipGroup>
      <Spacer size={16} />
      <TextField
        label="Years of experience (optional)"
        value={draft.yearsExperience}
        onChangeText={(yearsExperience) => patch({ yearsExperience })}
        placeholder="4"
        keyboardType="number-pad"
        maxLength={2}
        error={yearsInvalid ? 'A number, like 4.' : undefined}
        testID="input-years-experience"
      />
      <Spacer size={16} />
      <TextField
        label="Work location (optional)"
        value={draft.workLocation}
        onChangeText={(workLocation) => patch({ workLocation })}
        placeholder="Baner, Pune"
        autoCapitalize="words"
        maxLength={ONBOARDING_LIMITS.place.max}
        testID="input-work-location"
      />
      {draft.workLocation.trim() ? (
        <VisibilityToggle
          shown={draft.showWorkLocation}
          onChange={(showWorkLocation) => patch({ showWorkLocation })}
          subject="where you work"
          testID="toggle-show-work-location"
        />
      ) : null}
      <Spacer size={16} />
      <OptionChips
        label="How do you work?"
        optional
        options={WORK_MODES}
        labels={WORK_MODE_LABELS}
        value={draft.workMode}
        onChange={(workMode) => patch({ workMode })}
        testID="option-work-mode"
      />
    </>
  );
}

/* -------------------------------------------------------------- lifestyle -- */

export function LifestyleBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[24] }}>
      <OptionChips
        label="Smoking"
        optional
        options={SMOKING_HABITS}
        labels={SMOKING_LABELS}
        value={draft.smoking}
        onChange={(smoking) => patch({ smoking })}
        testID="option-smoking"
      />
      <OptionChips
        label="Drinking"
        optional
        options={DRINKING_HABITS}
        labels={DRINKING_LABELS}
        value={draft.drinking}
        onChange={(drinking) => patch({ drinking })}
        testID="option-drinking"
      />
      <OptionChips
        label="Food"
        optional
        options={DIETS}
        labels={DIET_LABELS}
        value={draft.diet}
        onChange={(diet) => patch({ diet })}
        testID="option-diet"
      />
      <OptionChips
        label="Exercise"
        optional
        options={EXERCISE_HABITS}
        labels={EXERCISE_LABELS}
        value={draft.exercise}
        onChange={(exercise) => patch({ exercise })}
        testID="option-exercise"
      />
      <OptionChips
        label="Sleep"
        optional
        options={SLEEP_SCHEDULES}
        labels={SLEEP_LABELS}
        value={draft.sleep}
        onChange={(sleep) => patch({ sleep })}
        testID="option-sleep"
      />
      <OptionChips
        label="Pets"
        optional
        options={PET_PREFERENCES}
        labels={PET_LABELS}
        value={draft.pets}
        onChange={(pets) => patch({ pets })}
        testID="option-pets"
      />
    </View>
  );
}
