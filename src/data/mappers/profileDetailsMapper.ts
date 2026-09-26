import {
  CHILDREN_PLANS,
  COFOUNDER_ROLES,
  DIETS,
  DRINKING_HABITS,
  EDUCATION_LEVELS,
  EXERCISE_HABITS,
  FAMILY_INVOLVEMENTS,
  FOUNDER_COMMITMENTS,
  FOUNDER_SKILLS,
  FUNDING_PLANS,
  HIDEABLE_FIELDS,
  IMPORTANCE_LEVELS,
  LIVING_ARRANGEMENTS,
  MARITAL_STATUSES,
  MARRIAGE_TIMELINES,
  OCCUPATION_STATUSES,
  PARTNER_VALUES,
  PET_PREFERENCES,
  PROFILE_PROMPTS,
  RELATIONSHIP_GOALS,
  RELIGIONS,
  RELOCATION_OPTIONS,
  SLEEP_SCHEDULES,
  SMOKING_HABITS,
  STARTUP_STAGES,
  STUDY_MODES,
  WORK_MODES,
  type HideableField,
  type ProfileDetails,
  type ProfileDetailsUpdate,
  type ProfilePrompt,
} from '@/domain/entities';
import type { Json, ProfileDetailsInsert, ProfileDetailsRow } from '@/infrastructure/supabase/rows';

/**
 * `profile_details` rows to and from `ProfileDetails`.
 *
 * Forgiving on the way in, like `toPerson`: an enum value this build has never
 * heard of becomes "not answered" rather than a throw, so a value added by a
 * later migration blanks one answer instead of the whole profile.
 */

/** The shape `profile_details_for()` returns: the row without its private columns. */
export type SharedProfileDetailsRow = Omit<
  ProfileDetailsRow,
  'hidden_fields' | 'onboarding_step' | 'created_at' | 'updated_at'
>;

const oneOf =
  <T extends string>(values: readonly T[]) =>
  (value: string | null | undefined): T | undefined =>
    value != null && (values as readonly string[]).includes(value) ? (value as T) : undefined;

const toOccupationStatus = oneOf(OCCUPATION_STATUSES);
const toEducationLevel = oneOf(EDUCATION_LEVELS);
const toStudyMode = oneOf(STUDY_MODES);
const toWorkMode = oneOf(WORK_MODES);
const toSmoking = oneOf(SMOKING_HABITS);
const toDrinking = oneOf(DRINKING_HABITS);
const toDiet = oneOf(DIETS);
const toExercise = oneOf(EXERCISE_HABITS);
const toSleep = oneOf(SLEEP_SCHEDULES);
const toPets = oneOf(PET_PREFERENCES);
const toPromptKey = oneOf(PROFILE_PROMPTS);
const toRelationshipGoal = oneOf(RELATIONSHIP_GOALS);
const toChildrenPlan = oneOf(CHILDREN_PLANS);
const toMarriageTimeline = oneOf(MARRIAGE_TIMELINES);
const toMaritalStatus = oneOf(MARITAL_STATUSES);
const toReligion = oneOf(RELIGIONS);
const toImportance = oneOf(IMPORTANCE_LEVELS);
const toLivingArrangement = oneOf(LIVING_ARRANGEMENTS);
const toFamilyInvolvement = oneOf(FAMILY_INVOLVEMENTS);
const toRelocation = oneOf(RELOCATION_OPTIONS);
const toCofounderRole = oneOf(COFOUNDER_ROLES);
const toStartupStage = oneOf(STARTUP_STAGES);
const toFounderCommitment = oneOf(FOUNDER_COMMITMENTS);
const toFundingPlan = oneOf(FUNDING_PLANS);

/** Keeps the values this build knows, in order, and drops the rest. */
const known =
  <T extends string>(values: readonly T[]) =>
  (list: readonly string[] | null | undefined): T[] =>
    (list ?? []).filter((value): value is T => (values as readonly string[]).includes(value));

const toPartnerValues = known(PARTNER_VALUES);
const toFounderSkills = known(FOUNDER_SKILLS);

/** Domain field name ↔ the column name stored in `hidden_fields`. */
const HIDDEN_COLUMN: Record<HideableField, string> = {
  lastName: 'last_name',
  hometown: 'hometown',
  institution: 'institution',
  company: 'company',
  workLocation: 'work_location',
  religion: 'religion',
};

function toPrompts(value: Json): ProfilePrompt[] {
  if (!Array.isArray(value)) return [];
  const prompts: ProfilePrompt[] = [];
  for (const item of value) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const key = toPromptKey(typeof item.key === 'string' ? item.key : null);
    if (key && typeof item.answer === 'string') prompts.push({ key, answer: item.answer });
  }
  return prompts;
}

function toHiddenFields(columns: string[]): HideableField[] {
  return HIDEABLE_FIELDS.filter((field) => columns.includes(HIDDEN_COLUMN[field]));
}

/** Drops nulls, so an unanswered question is absent rather than `null`. */
function defined<T extends object>(value: T): { [K in keyof T]: Exclude<T[K], null> } {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined),
  ) as { [K in keyof T]: Exclude<T[K], null> };
}

export function toProfileDetails(
  row: SharedProfileDetailsRow &
    Partial<Pick<ProfileDetailsRow, 'hidden_fields' | 'onboarding_step'>>,
): ProfileDetails {
  return {
    ...defined({
      lastName: row.last_name,
      pronouns: row.pronouns,
      hometown: row.hometown,
      occupationStatus: toOccupationStatus(row.occupation_status),
      educationLevel: toEducationLevel(row.education_level),
      institution: row.institution,
      degree: row.degree,
      fieldOfStudy: row.field_of_study,
      graduationYear: row.graduation_year,
      studyYear: row.study_year,
      studyMode: toStudyMode(row.study_mode),
      previousEducation: row.previous_education,
      internship: row.internship,
      occupation: row.occupation,
      jobTitle: row.job_title,
      company: row.company,
      industry: row.industry,
      yearsExperience: row.years_experience,
      workLocation: row.work_location,
      workMode: toWorkMode(row.work_mode),
      smoking: toSmoking(row.smoking),
      drinking: toDrinking(row.drinking),
      diet: toDiet(row.diet),
      exercise: toExercise(row.exercise),
      sleep: toSleep(row.sleep),
      pets: toPets(row.pets),
      relationshipGoal: toRelationshipGoal(row.relationship_goal),
      childrenPlan: toChildrenPlan(row.children_plan),
      marriageTimeline: toMarriageTimeline(row.marriage_timeline),
      maritalStatus: toMaritalStatus(row.marital_status),
      religion: toReligion(row.religion),
      faithImportance: toImportance(row.faith_importance),
      livingArrangement: toLivingArrangement(row.living_arrangement),
      familyInvolvement: toFamilyInvolvement(row.family_involvement),
      openToRelocate: toRelocation(row.open_to_relocate),
      cofounderRole: toCofounderRole(row.cofounder_role),
      startupStage: toStartupStage(row.startup_stage),
      founderCommitment: toFounderCommitment(row.founder_commitment),
      fundingPlan: toFundingPlan(row.funding_plan),
      onboardingStep: row.onboarding_step,
    }),
    languages: row.languages ?? [],
    careerInterests: row.career_interests ?? [],
    skills: row.skills ?? [],
    prompts: toPrompts(row.prompts),
    partnerValues: toPartnerValues(row.partner_values),
    founderSkills: toFounderSkills(row.founder_skills),
    seekingSkills: toFounderSkills(row.seeking_skills),
    startupIndustries: row.startup_industries ?? [],
    // Somebody else's copy has no hidden_fields: what they hid is already gone.
    hiddenFields: row.hidden_fields ? toHiddenFields(row.hidden_fields) : [],
  };
}

/** The columns an update writes. `null` clears; an absent key is left alone. */
export function toProfileDetailsRow(
  update: ProfileDetailsUpdate,
): Omit<ProfileDetailsInsert, 'member_id'> {
  const row: Omit<ProfileDetailsInsert, 'member_id'> = {};
  const text = (value: string | null | undefined): string | null | undefined =>
    value === undefined ? undefined : value === null || !value.trim() ? null : value.trim();

  const set = <K extends keyof typeof row>(key: K, value: (typeof row)[K] | undefined): void => {
    if (value !== undefined) row[key] = value;
  };

  set('last_name', text(update.lastName));
  set('pronouns', text(update.pronouns));
  set('hometown', text(update.hometown));
  if (update.languages !== undefined) row.languages = update.languages ?? [];

  set('occupation_status', update.occupationStatus);
  set('education_level', update.educationLevel);
  set('institution', text(update.institution));
  set('degree', text(update.degree));
  set('field_of_study', text(update.fieldOfStudy));
  set('graduation_year', update.graduationYear);

  set('study_year', update.studyYear);
  set('study_mode', update.studyMode);
  set('previous_education', text(update.previousEducation));
  set('internship', text(update.internship));
  if (update.careerInterests !== undefined) row.career_interests = update.careerInterests ?? [];
  if (update.skills !== undefined) row.skills = update.skills ?? [];

  set('occupation', text(update.occupation));
  set('job_title', text(update.jobTitle));
  set('company', text(update.company));
  set('industry', text(update.industry));
  set('years_experience', update.yearsExperience);
  set('work_location', text(update.workLocation));
  set('work_mode', update.workMode);

  set('smoking', update.smoking);
  set('drinking', update.drinking);
  set('diet', update.diet);
  set('exercise', update.exercise);
  set('sleep', update.sleep);
  set('pets', update.pets);

  if (update.prompts !== undefined) {
    row.prompts = (update.prompts ?? []).map((prompt) => ({
      key: prompt.key,
      answer: prompt.answer.trim(),
    }));
  }
  if (update.hiddenFields !== undefined) {
    row.hidden_fields = (update.hiddenFields ?? []).map((field) => HIDDEN_COLUMN[field]);
  }
  set('relationship_goal', update.relationshipGoal);
  set('children_plan', update.childrenPlan);
  if (update.partnerValues !== undefined) row.partner_values = update.partnerValues ?? [];
  set('marriage_timeline', update.marriageTimeline);
  set('marital_status', update.maritalStatus);
  set('religion', update.religion);
  set('faith_importance', update.faithImportance);
  set('living_arrangement', update.livingArrangement);
  set('family_involvement', update.familyInvolvement);
  set('open_to_relocate', update.openToRelocate);
  set('cofounder_role', update.cofounderRole);
  set('startup_stage', update.startupStage);
  if (update.founderSkills !== undefined) row.founder_skills = update.founderSkills ?? [];
  if (update.seekingSkills !== undefined) row.seeking_skills = update.seekingSkills ?? [];
  set('founder_commitment', update.founderCommitment);
  if (update.startupIndustries !== undefined) {
    row.startup_industries = update.startupIndustries ?? [];
  }
  set('funding_plan', update.fundingPlan);

  set('onboarding_step', update.onboardingStep);

  return row;
}
