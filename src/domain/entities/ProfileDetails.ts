/**
 * The common profile: what every member is asked, whatever they are here for.
 *
 * Separate from `Person` because it is stored and shared differently. A
 * `Person` is what any verified member can read in full. These answers are
 * the member's own, and some of them — surname, hometown, where they study or
 * work — the member can hide. Keeping them on a different type means a screen
 * that shows somebody else's profile has to ask for these on purpose, through
 * a call that has already removed what was hidden.
 *
 * Every answer is optional. "Not answered" is `undefined` and never a default,
 * because an empty string or a zero would be indistinguishable from a real
 * answer to anybody reading the profile.
 */

import type { MeetIntent, SelectableIntent } from './Person';

/* ------------------------------------------------------------ options ---- */

// Each list mirrors a Postgres enum in migration 0012, and the strings are the
// contract. The labels are product language — the phone and the admin portal
// should use the same words — so they live here rather than in a screen.

export const OCCUPATION_STATUSES = [
  'working',
  'studying',
  'both',
  'neither',
  'prefer_not_to_say',
] as const;
export type OccupationStatus = (typeof OCCUPATION_STATUSES)[number];

export const OCCUPATION_STATUS_LABELS: Record<OccupationStatus, string> = {
  working: 'Working',
  studying: 'Studying',
  both: 'Both',
  neither: 'Neither right now',
  prefer_not_to_say: 'Prefer not to say',
};

export const EDUCATION_LEVELS = [
  'high_school',
  'diploma',
  'bachelors',
  'masters',
  'doctorate',
  'other',
  'prefer_not_to_say',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  high_school: 'High school',
  diploma: 'Diploma',
  bachelors: 'Bachelor’s',
  masters: 'Master’s',
  doctorate: 'Doctorate',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

export const STUDY_MODES = ['full_time', 'part_time'] as const;
export type StudyMode = (typeof STUDY_MODES)[number];
export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
};

export const WORK_MODES = ['on_site', 'hybrid', 'remote', 'flexible'] as const;
export type WorkMode = (typeof WORK_MODES)[number];
export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  on_site: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
  flexible: 'Flexible',
};

export const SMOKING_HABITS = [
  'never',
  'socially',
  'regularly',
  'trying_to_quit',
  'prefer_not_to_say',
] as const;
export type SmokingHabit = (typeof SMOKING_HABITS)[number];
export const SMOKING_LABELS: Record<SmokingHabit, string> = {
  never: 'Never',
  socially: 'Socially',
  regularly: 'Regularly',
  trying_to_quit: 'Trying to quit',
  prefer_not_to_say: 'Prefer not to say',
};

export const DRINKING_HABITS = ['never', 'socially', 'regularly', 'prefer_not_to_say'] as const;
export type DrinkingHabit = (typeof DRINKING_HABITS)[number];
export const DRINKING_LABELS: Record<DrinkingHabit, string> = {
  never: 'Never',
  socially: 'Socially',
  regularly: 'Regularly',
  prefer_not_to_say: 'Prefer not to say',
};

export const DIETS = [
  'vegetarian',
  'eggetarian',
  'non_vegetarian',
  'vegan',
  'jain',
  'other',
  'prefer_not_to_say',
] as const;
export type Diet = (typeof DIETS)[number];
export const DIET_LABELS: Record<Diet, string> = {
  vegetarian: 'Vegetarian',
  eggetarian: 'Eggetarian',
  non_vegetarian: 'Non-vegetarian',
  vegan: 'Vegan',
  jain: 'Jain',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

export const EXERCISE_HABITS = ['never', 'sometimes', 'regularly', 'daily'] as const;
export type ExerciseHabit = (typeof EXERCISE_HABITS)[number];
export const EXERCISE_LABELS: Record<ExerciseHabit, string> = {
  never: 'Never',
  sometimes: 'Sometimes',
  regularly: 'Regularly',
  daily: 'Every day',
};

export const SLEEP_SCHEDULES = ['early_bird', 'night_owl', 'varies'] as const;
export type SleepSchedule = (typeof SLEEP_SCHEDULES)[number];
export const SLEEP_LABELS: Record<SleepSchedule, string> = {
  early_bird: 'Early bird',
  night_owl: 'Night owl',
  varies: 'It varies',
};

export const PET_PREFERENCES = ['have_pets', 'want_pets', 'no_pets', 'allergic'] as const;
export type PetPreference = (typeof PET_PREFERENCES)[number];
export const PET_LABELS: Record<PetPreference, string> = {
  have_pets: 'Have pets',
  want_pets: 'Want pets',
  no_pets: 'No pets',
  allergic: 'Allergic',
};

/* ------------------------------------------------------ category: dating -- */

// The questions that depend on what a member is here for. Each list mirrors a
// Postgres enum (or, for PARTNER_VALUES, a CHECK) in migration 0014.

export const RELATIONSHIP_GOALS = [
  'long_term',
  'long_term_open_to_short',
  'short_term_open_to_long',
  'short_term',
  'figuring_out',
] as const;
export type RelationshipGoal = (typeof RELATIONSHIP_GOALS)[number];
export const RELATIONSHIP_GOAL_LABELS: Record<RelationshipGoal, string> = {
  long_term: 'Long-term',
  long_term_open_to_short: 'Long-term, open to short',
  short_term_open_to_long: 'Short-term, open to long',
  short_term: 'Something casual',
  figuring_out: 'Still figuring it out',
};

export const CHILDREN_PLANS = [
  'want',
  'dont_want',
  'have_want_more',
  'have_dont_want_more',
  'open',
  'not_sure',
] as const;
export type ChildrenPlan = (typeof CHILDREN_PLANS)[number];
export const CHILDREN_PLAN_LABELS: Record<ChildrenPlan, string> = {
  want: 'Want children',
  dont_want: 'Don’t want children',
  have_want_more: 'Have, want more',
  have_dont_want_more: 'Have, don’t want more',
  open: 'Open to it',
  not_sure: 'Not sure',
};

export const PARTNER_VALUES = [
  'kindness',
  'humour',
  'ambition',
  'honesty',
  'curiosity',
  'family',
  'faith',
  'adventure',
  'loyalty',
  'independence',
] as const;
export type PartnerValue = (typeof PARTNER_VALUES)[number];
export const PARTNER_VALUE_LABELS: Record<PartnerValue, string> = {
  kindness: 'Kindness',
  humour: 'Humour',
  ambition: 'Ambition',
  honesty: 'Honesty',
  curiosity: 'Curiosity',
  family: 'Family',
  faith: 'Faith',
  adventure: 'Adventure',
  loyalty: 'Loyalty',
  independence: 'Independence',
};

/* ------------------------------------------------ category: life partner -- */

export const MARRIAGE_TIMELINES = [
  'within_1_year',
  'one_to_two_years',
  'two_to_three_years',
  'not_sure',
] as const;
export type MarriageTimeline = (typeof MARRIAGE_TIMELINES)[number];
export const MARRIAGE_TIMELINE_LABELS: Record<MarriageTimeline, string> = {
  within_1_year: 'Within a year',
  one_to_two_years: '1–2 years',
  two_to_three_years: '2–3 years',
  not_sure: 'Not sure yet',
};

export const MARITAL_STATUSES = [
  'never_married',
  'divorced',
  'separated',
  'widowed',
  'prefer_not_to_say',
] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];
export const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  never_married: 'Never married',
  divorced: 'Divorced',
  separated: 'Separated',
  widowed: 'Widowed',
  prefer_not_to_say: 'Prefer not to say',
};

export const RELIGIONS = [
  'hindu',
  'muslim',
  'christian',
  'sikh',
  'jain',
  'buddhist',
  'parsi',
  'jewish',
  'spiritual',
  'not_religious',
  'other',
  'prefer_not_to_say',
] as const;
export type Religion = (typeof RELIGIONS)[number];
export const RELIGION_LABELS: Record<Religion, string> = {
  hindu: 'Hindu',
  muslim: 'Muslim',
  christian: 'Christian',
  sikh: 'Sikh',
  jain: 'Jain',
  buddhist: 'Buddhist',
  parsi: 'Parsi',
  jewish: 'Jewish',
  spiritual: 'Spiritual',
  not_religious: 'Not religious',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

export const IMPORTANCE_LEVELS = ['very', 'somewhat', 'not_really'] as const;
export type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number];
export const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  very: 'Very',
  somewhat: 'Somewhat',
  not_really: 'Not really',
};

export const LIVING_ARRANGEMENTS = ['with_family', 'on_our_own', 'open', 'not_sure'] as const;
export type LivingArrangement = (typeof LIVING_ARRANGEMENTS)[number];
export const LIVING_ARRANGEMENT_LABELS: Record<LivingArrangement, string> = {
  with_family: 'With family',
  on_our_own: 'On our own',
  open: 'Open to either',
  not_sure: 'Not sure',
};

export const FAMILY_INVOLVEMENTS = ['my_decision', 'family_involved', 'family_led'] as const;
export type FamilyInvolvement = (typeof FAMILY_INVOLVEMENTS)[number];
export const FAMILY_INVOLVEMENT_LABELS: Record<FamilyInvolvement, string> = {
  my_decision: 'My decision',
  family_involved: 'Family involved',
  family_led: 'Family-led',
};

export const RELOCATION_OPTIONS = ['yes', 'maybe', 'no'] as const;
export type RelocationOpenness = (typeof RELOCATION_OPTIONS)[number];
export const RELOCATION_LABELS: Record<RelocationOpenness, string> = {
  yes: 'Yes',
  maybe: 'Maybe',
  no: 'No',
};

/* -------------------------------------------------- category: co-founder -- */

export const COFOUNDER_ROLES = ['have_startup', 'want_to_join', 'either'] as const;
export type CofounderRole = (typeof COFOUNDER_ROLES)[number];
export const COFOUNDER_ROLE_LABELS: Record<CofounderRole, string> = {
  have_startup: 'I have a startup or idea',
  want_to_join: 'I want to join one',
  either: 'Either',
};

export const STARTUP_STAGES = ['idea', 'prototype', 'launched', 'revenue'] as const;
export type StartupStage = (typeof STARTUP_STAGES)[number];
export const STARTUP_STAGE_LABELS: Record<StartupStage, string> = {
  idea: 'Idea',
  prototype: 'Prototype',
  launched: 'Launched',
  revenue: 'Making revenue',
};

export const FOUNDER_SKILLS = [
  'engineering',
  'product',
  'design',
  'sales',
  'marketing',
  'operations',
  'finance',
  'domain_expert',
] as const;
export type FounderSkill = (typeof FOUNDER_SKILLS)[number];
export const FOUNDER_SKILL_LABELS: Record<FounderSkill, string> = {
  engineering: 'Engineering',
  product: 'Product',
  design: 'Design',
  sales: 'Sales',
  marketing: 'Marketing',
  operations: 'Operations',
  finance: 'Finance',
  domain_expert: 'Domain expert',
};

export const FOUNDER_COMMITMENTS = ['full_time_now', 'full_time_soon', 'part_time'] as const;
export type FounderCommitment = (typeof FOUNDER_COMMITMENTS)[number];
export const FOUNDER_COMMITMENT_LABELS: Record<FounderCommitment, string> = {
  full_time_now: 'Full-time now',
  full_time_soon: 'Full-time soon',
  part_time: 'Part-time',
};

export const FUNDING_PLANS = [
  'bootstrapping',
  'raised',
  'planning_to_raise',
  'can_invest',
  'not_sure',
] as const;
export type FundingPlan = (typeof FUNDING_PLANS)[number];
export const FUNDING_PLAN_LABELS: Record<FundingPlan, string> = {
  bootstrapping: 'Bootstrapping',
  raised: 'Raised funding',
  planning_to_raise: 'Planning to raise',
  can_invest: 'Can invest',
  not_sure: 'Not sure',
};

/* ------------------------------------------------------------ prompts ---- */

/** Mirrors `valid_profile_prompts()` in migration 0012. Add to both or neither. */
export const PROFILE_PROMPTS = [
  'perfect_weekend',
  'talk_for_hours',
  'friends_describe',
  'excited_about',
  'you_should_know',
] as const;
export type PromptKey = (typeof PROFILE_PROMPTS)[number];

export const PROMPT_LABELS: Record<PromptKey, string> = {
  perfect_weekend: 'A perfect weekend for me is…',
  talk_for_hours: 'Something I could talk about for hours…',
  friends_describe: 'My friends would describe me as…',
  excited_about: 'Something I’m excited about…',
  you_should_know: 'You should know that I…',
};

export type ProfilePrompt = { key: PromptKey; answer: string };

/* ------------------------------------------------------------ privacy ---- */

/**
 * The answers a member may keep to themselves.
 *
 * Only these, because they are the ones that identify somebody outside the
 * app. Everything else on the profile is there to be read — hiding it would
 * leave a card with nothing on it. Mirrors the CHECK on `hidden_fields`.
 */
export const HIDEABLE_FIELDS = [
  'lastName',
  'hometown',
  'institution',
  'company',
  'workLocation',
  // Not identifying in the same way, but sensitive, so it starts hidden and
  // is shown only when the member chooses. See migration 0014.
  'religion',
] as const;
export type HideableField = (typeof HIDEABLE_FIELDS)[number];

/** The surname (0012) and religion (0014) start hidden. */
export const DEFAULT_HIDDEN_FIELDS: HideableField[] = ['lastName', 'religion'];

/* ------------------------------------------------------------- entity ---- */

export type ProfileDetails = {
  lastName?: string;
  pronouns?: string;
  hometown?: string;
  languages: string[];

  occupationStatus?: OccupationStatus;

  /** For a student, what they are studying now; `graduationYear` is then expected. */
  educationLevel?: EducationLevel;
  institution?: string;
  degree?: string;
  fieldOfStudy?: string;
  graduationYear?: number;

  studyYear?: number;
  studyMode?: StudyMode;
  previousEducation?: string;
  internship?: string;
  careerInterests: string[];
  skills: string[];

  occupation?: string;
  jobTitle?: string;
  company?: string;
  industry?: string;
  yearsExperience?: number;
  workLocation?: string;
  workMode?: WorkMode;

  smoking?: SmokingHabit;
  drinking?: DrinkingHabit;
  diet?: Diet;
  exercise?: ExerciseHabit;
  sleep?: SleepSchedule;
  pets?: PetPreference;

  prompts: ProfilePrompt[];

  // Category answers. Stored whatever the purpose, shown to others only for
  // the purpose the member is here for now — see `categoryFieldsFor`.
  relationshipGoal?: RelationshipGoal;
  /** Asked for dating and for life partner. */
  childrenPlan?: ChildrenPlan;
  partnerValues: PartnerValue[];

  marriageTimeline?: MarriageTimeline;
  maritalStatus?: MaritalStatus;
  religion?: Religion;
  faithImportance?: ImportanceLevel;
  livingArrangement?: LivingArrangement;
  familyInvolvement?: FamilyInvolvement;
  openToRelocate?: RelocationOpenness;

  cofounderRole?: CofounderRole;
  /** Only asked when the member has a startup of their own. */
  startupStage?: StartupStage;
  founderSkills: FounderSkill[];
  seekingSkills: FounderSkill[];
  founderCommitment?: FounderCommitment;
  startupIndustries: string[];
  fundingPlan?: FundingPlan;

  hiddenFields: HideableField[];
  /** The last onboarding step saved. Only ever the owner's. */
  onboardingStep?: string;
};

export const EMPTY_PROFILE_DETAILS: ProfileDetails = {
  languages: [],
  careerInterests: [],
  skills: [],
  prompts: [],
  partnerValues: [],
  founderSkills: [],
  seekingSkills: [],
  startupIndustries: [],
  hiddenFields: DEFAULT_HIDDEN_FIELDS,
};

/**
 * A change to the common profile.
 *
 * `null` clears an answer; an absent key leaves it alone. The two have to be
 * different, or there is no way to take back an answer once given.
 */
export type ProfileDetailsUpdate = {
  [K in keyof ProfileDetails]?: ProfileDetails[K] | null;
};

/* -------------------------------------------------------------- rules ---- */

export function isStudying(status: OccupationStatus | undefined): boolean {
  return status === 'studying' || status === 'both';
}

export function isWorking(status: OccupationStatus | undefined): boolean {
  return status === 'working' || status === 'both';
}

/** The category answers, by the purpose that asks them. */
const CATEGORY_FIELDS: Record<SelectableIntent, readonly (keyof ProfileDetails)[]> = {
  dating: ['relationshipGoal', 'childrenPlan', 'partnerValues'],
  life_partner: [
    'childrenPlan',
    'marriageTimeline',
    'maritalStatus',
    'religion',
    'faithImportance',
    'livingArrangement',
    'familyInvolvement',
    'openToRelocate',
  ],
  co_founder: [
    'cofounderRole',
    'startupStage',
    'founderSkills',
    'seekingSkills',
    'founderCommitment',
    'startupIndustries',
    'fundingPlan',
  ],
};

const ALL_CATEGORY_FIELDS = new Set(Object.values(CATEGORY_FIELDS).flat());

/** The category answers that belong to these purposes. */
export function categoryFieldsFor(intents: readonly MeetIntent[]): Set<keyof ProfileDetails> {
  return new Set(
    intents.flatMap((intent) =>
      intent in CATEGORY_FIELDS ? CATEGORY_FIELDS[intent as SelectableIntent] : [],
    ),
  );
}

/**
 * The profile as another member sees it: hidden answers removed, and only the
 * category answers for the member's current purpose.
 *
 * The server does the same thing in `profile_details_for()`, and that is the
 * one that protects anybody. This copy exists so the preview a member is shown
 * before finishing is the truth about what others will see, not a guess.
 */
export function visibleToOthers(
  details: ProfileDetails,
  intents: readonly MeetIntent[],
): ProfileDetails {
  const shown: Record<string, unknown> = { ...details };
  for (const field of details.hiddenFields) delete shown[field];

  const current = categoryFieldsFor(intents);
  for (const field of ALL_CATEGORY_FIELDS) {
    if (current.has(field)) continue;
    const empty = (EMPTY_PROFILE_DETAILS as Record<string, unknown>)[field];
    if (empty === undefined) delete shown[field];
    else shown[field] = empty;
  }
  return shown as ProfileDetails;
}

/**
 * The first required category answer that is missing, or null.
 *
 * The same rule as `complete_my_onboarding()` in migration 0014 — change one,
 * change both:
 *
 *   dating        relationship goal
 *   life partner  marriage timeline and marital status
 *   co-founder    role, commitment, and at least one skill to look for
 */
export function missingCategoryAnswer(
  intents: readonly MeetIntent[],
  details: ProfileDetails,
): { message: string; field: keyof ProfileDetails } | null {
  if (intents.includes('dating') && !details.relationshipGoal) {
    return {
      message: 'Tell us what kind of relationship you’re looking for.',
      field: 'relationshipGoal',
    };
  }
  if (intents.includes('life_partner')) {
    if (!details.marriageTimeline) {
      return { message: 'Add when you’d like to get married.', field: 'marriageTimeline' };
    }
    if (!details.maritalStatus) {
      return { message: 'Add your marital status.', field: 'maritalStatus' };
    }
  }
  if (intents.includes('co_founder')) {
    if (!details.cofounderRole) {
      return { message: 'Tell us your side of the startup.', field: 'cofounderRole' };
    }
    if (!details.founderCommitment) {
      return { message: 'Tell us how much time you can commit.', field: 'founderCommitment' };
    }
    if (details.seekingSkills.length === 0) {
      return {
        message: 'Pick at least one skill you need in a co-founder.',
        field: 'seekingSkills',
      };
    }
  }
  return null;
}
