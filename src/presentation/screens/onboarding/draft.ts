import {
  SELECTABLE_INTENTS,
  type ChildrenPlan,
  type CofounderRole,
  type FamilyInvolvement,
  type FounderCommitment,
  type FounderSkill,
  type FundingPlan,
  type ImportanceLevel,
  type LivingArrangement,
  type MaritalStatus,
  type MarriageTimeline,
  type PartnerValue,
  type RelationshipGoal,
  type Religion,
  type RelocationOpenness,
  type StartupStage,
  type Diet,
  type DrinkingHabit,
  type EducationLevel,
  type ExerciseHabit,
  type Gender,
  type HideableField,
  type OccupationStatus,
  type Person,
  type PetPreference,
  type Preferences,
  type ProfileDetails,
  type ProfilePrompt,
  type SelectableIntent,
  type SleepSchedule,
  type SmokingHabit,
  type StudyMode,
  type WorkMode,
} from '@/domain/entities';

/**
 * The wizard's working copy.
 *
 * Every field is present from the start and empty where unanswered, rather
 * than being a `Partial<…>`. With a fixed shape, "has this been answered" is a
 * comparison, and TypeScript can check that the step which asks for a gender is
 * the step that writes one.
 *
 * Numbers the member types — years, a graduation year — are held as the text
 * they typed. Converting on every keystroke would turn a half-typed "20" into a
 * graduation year of 20 and throw away the leading digits of anything invalid.
 * They become numbers when the step is saved (see `steps.tsx`).
 *
 * `show*` flags are the privacy toggles, held the way the member reads them.
 * They become `hiddenFields` on save.
 */
export type OnboardingDraft = {
  purpose: SelectableIntent | null;

  firstName: string;
  lastName: string;
  showLastName: boolean;
  /** ISO date, or null while it is not a valid one. */
  dateOfBirth: string | null;
  gender: Gender | null;
  pronouns: string;
  interestedIn: Gender[];

  city: string;
  hometown: string;
  showHometown: boolean;
  languages: string[];

  occupationStatus: OccupationStatus | null;

  educationLevel: EducationLevel | null;
  institution: string;
  showInstitution: boolean;
  degree: string;
  fieldOfStudy: string;
  graduationYear: string;

  studyYear: string;
  studyMode: StudyMode | null;
  previousEducation: string;
  internship: string;
  careerInterests: string[];
  skills: string[];

  occupation: string;
  jobTitle: string;
  company: string;
  showCompany: boolean;
  industry: string;
  yearsExperience: string;
  workLocation: string;
  showWorkLocation: boolean;
  workMode: WorkMode | null;

  smoking: SmokingHabit | null;
  drinking: DrinkingHabit | null;
  diet: Diet | null;
  exercise: ExerciseHabit | null;
  sleep: SleepSchedule | null;
  pets: PetPreference | null;

  interests: string[];
  bio: string;
  headline: string;
  prompts: ProfilePrompt[];

  // Category answers. Kept in the draft whatever the purpose, so switching
  // purpose and back does not throw anything away.
  relationshipGoal: RelationshipGoal | null;
  childrenPlan: ChildrenPlan | null;
  partnerValues: PartnerValue[];

  marriageTimeline: MarriageTimeline | null;
  maritalStatus: MaritalStatus | null;
  religion: Religion | null;
  showReligion: boolean;
  faithImportance: ImportanceLevel | null;
  livingArrangement: LivingArrangement | null;
  familyInvolvement: FamilyInvolvement | null;
  openToRelocate: RelocationOpenness | null;

  cofounderRole: CofounderRole | null;
  startupStage: StartupStage | null;
  founderSkills: FounderSkill[];
  seekingSkills: FounderSkill[];
  founderCommitment: FounderCommitment | null;
  startupIndustries: string[];
  fundingPlan: FundingPlan | null;

  ageMin: number;
  ageMax: number;

  agreedToGuidelines: boolean;
  /** Null until asked, so "not answered" and "said no" stay different. */
  pushEnabled: boolean | null;
};

const isHidden = (hidden: HideableField[], field: HideableField): boolean => hidden.includes(field);

/**
 * The draft for somebody resuming — or starting, when everything is empty.
 *
 * Built from what the server has, so a member who closed the app on step nine
 * comes back to their answers rather than to blank fields. The signup trigger
 * names every new profile "New member"; that is not an answer and is not shown
 * as one.
 */
export function draftFrom(
  person: Person,
  details: ProfileDetails,
  preferences: Preferences,
): OnboardingDraft {
  const intent = person.intents.find((value): value is SelectableIntent =>
    (SELECTABLE_INTENTS as readonly string[]).includes(value),
  );
  // The empty profile already carries the default (surname hidden), so a
  // member who has never saved sees the same starting point as the server.
  const hidden = details.hiddenFields;
  const text = (value: string | undefined): string => value ?? '';
  const number = (value: number | undefined): string => (value === undefined ? '' : String(value));

  return {
    purpose: intent ?? null,

    firstName: person.name === 'New member' ? '' : person.name,
    lastName: text(details.lastName),
    showLastName: !isHidden(hidden, 'lastName'),
    dateOfBirth: person.dateOfBirth ?? null,
    gender: person.gender ?? null,
    pronouns: text(details.pronouns),
    interestedIn: preferences.interestedIn,

    // May still be the signup trigger's default; the wizard blanks it until
    // the location step has been saved (see `initialState`).
    city: person.city,
    hometown: text(details.hometown),
    showHometown: !isHidden(hidden, 'hometown'),
    languages: details.languages,

    occupationStatus: details.occupationStatus ?? null,

    educationLevel: details.educationLevel ?? null,
    institution: text(details.institution),
    showInstitution: !isHidden(hidden, 'institution'),
    degree: text(details.degree),
    fieldOfStudy: text(details.fieldOfStudy),
    graduationYear: number(details.graduationYear),

    studyYear: number(details.studyYear),
    studyMode: details.studyMode ?? null,
    previousEducation: text(details.previousEducation),
    internship: text(details.internship),
    careerInterests: details.careerInterests,
    skills: details.skills,

    occupation: text(details.occupation),
    jobTitle: text(details.jobTitle),
    company: text(details.company),
    showCompany: !isHidden(hidden, 'company'),
    industry: text(details.industry),
    yearsExperience: number(details.yearsExperience),
    workLocation: text(details.workLocation),
    showWorkLocation: !isHidden(hidden, 'workLocation'),
    workMode: details.workMode ?? null,

    smoking: details.smoking ?? null,
    drinking: details.drinking ?? null,
    diet: details.diet ?? null,
    exercise: details.exercise ?? null,
    sleep: details.sleep ?? null,
    pets: details.pets ?? null,

    interests: person.interests,
    bio: text(person.bio),
    headline: person.headline,
    prompts: details.prompts,

    relationshipGoal: details.relationshipGoal ?? null,
    childrenPlan: details.childrenPlan ?? null,
    partnerValues: details.partnerValues,

    marriageTimeline: details.marriageTimeline ?? null,
    maritalStatus: details.maritalStatus ?? null,
    religion: details.religion ?? null,
    showReligion: !isHidden(hidden, 'religion'),
    faithImportance: details.faithImportance ?? null,
    livingArrangement: details.livingArrangement ?? null,
    familyInvolvement: details.familyInvolvement ?? null,
    openToRelocate: details.openToRelocate ?? null,

    cofounderRole: details.cofounderRole ?? null,
    startupStage: details.startupStage ?? null,
    founderSkills: details.founderSkills,
    seekingSkills: details.seekingSkills,
    founderCommitment: details.founderCommitment ?? null,
    startupIndustries: details.startupIndustries,
    fundingPlan: details.fundingPlan ?? null,

    ageMin: preferences.ageMin,
    ageMax: preferences.ageMax,

    agreedToGuidelines: false,
    pushEnabled: null,
  };
}

/** The privacy toggles, as the list the server stores. */
export function hiddenFieldsOf(draft: OnboardingDraft): HideableField[] {
  const hidden: HideableField[] = [];
  if (!draft.showLastName) hidden.push('lastName');
  if (!draft.showHometown) hidden.push('hometown');
  if (!draft.showInstitution) hidden.push('institution');
  if (!draft.showCompany) hidden.push('company');
  if (!draft.showWorkLocation) hidden.push('workLocation');
  if (!draft.showReligion) hidden.push('religion');
  return hidden;
}

/** Empty text means "no answer", which the server stores as null. */
export const textOrNull = (value: string): string | null => value.trim() || null;

/** A typed whole number, or null when blank. Anything else fails `isWholeNumberOrBlank`. */
export const wholeNumberOrNull = (value: string): number | null =>
  value.trim() === '' ? null : Number.parseInt(value.trim(), 10);

export const isWholeNumberOrBlank = (value: string): boolean => /^\d*$/.test(value.trim());
