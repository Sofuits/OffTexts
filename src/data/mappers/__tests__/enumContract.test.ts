import type {
  ChildrenPlan,
  CofounderRole,
  Diet,
  DrinkingHabit,
  EducationLevel,
  ExerciseHabit,
  FamilyInvolvement,
  FounderCommitment,
  FounderSkill,
  FundingPlan,
  Gender,
  ImportanceLevel,
  LivingArrangement,
  MaritalStatus,
  MarriageTimeline,
  MeetIntent,
  OccupationStatus,
  PetPreference,
  RelationshipGoal,
  Religion,
  RelocationOpenness,
  SleepSchedule,
  SmokingHabit,
  StartupStage,
  StudyMode,
  WorkMode,
} from '@/domain/entities';
import type { Enum } from '@/infrastructure/supabase/rows';

/**
 * The domain's option lists and the database's enums are the same lists.
 *
 * Checked by the compiler, not at runtime: each line below stops compiling if
 * a value exists on one side and not the other. A value added to a Postgres
 * enum by a migration and not to the app — or the reverse — fails here rather
 * than as a blank answer on somebody's profile.
 */

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const contract = {
  gender: true satisfies Same<Gender, Enum<'gender'>>,
  meetIntent: true satisfies Same<MeetIntent, Enum<'meet_intent'>>,
  occupationStatus: true satisfies Same<OccupationStatus, Enum<'occupation_status'>>,
  educationLevel: true satisfies Same<EducationLevel, Enum<'education_level'>>,
  studyMode: true satisfies Same<StudyMode, Enum<'study_mode'>>,
  workMode: true satisfies Same<WorkMode, Enum<'work_mode'>>,
  smoking: true satisfies Same<SmokingHabit, Enum<'smoking_habit'>>,
  drinking: true satisfies Same<DrinkingHabit, Enum<'drinking_habit'>>,
  diet: true satisfies Same<Diet, Enum<'diet_preference'>>,
  exercise: true satisfies Same<ExerciseHabit, Enum<'exercise_habit'>>,
  sleep: true satisfies Same<SleepSchedule, Enum<'sleep_schedule'>>,
  pets: true satisfies Same<PetPreference, Enum<'pet_preference'>>,
  relationshipGoal: true satisfies Same<RelationshipGoal, Enum<'relationship_goal'>>,
  childrenPlan: true satisfies Same<ChildrenPlan, Enum<'children_plan'>>,
  marriageTimeline: true satisfies Same<MarriageTimeline, Enum<'marriage_timeline'>>,
  maritalStatus: true satisfies Same<MaritalStatus, Enum<'marital_status'>>,
  religion: true satisfies Same<Religion, Enum<'religion'>>,
  importance: true satisfies Same<ImportanceLevel, Enum<'importance_level'>>,
  living: true satisfies Same<LivingArrangement, Enum<'living_arrangement'>>,
  family: true satisfies Same<FamilyInvolvement, Enum<'family_involvement'>>,
  relocation: true satisfies Same<RelocationOpenness, Enum<'relocation_openness'>>,
  cofounderRole: true satisfies Same<CofounderRole, Enum<'cofounder_role'>>,
  startupStage: true satisfies Same<StartupStage, Enum<'startup_stage'>>,
  founderSkill: true satisfies Same<FounderSkill, Enum<'founder_skill'>>,
  commitment: true satisfies Same<FounderCommitment, Enum<'founder_commitment'>>,
  funding: true satisfies Same<FundingPlan, Enum<'funding_plan'>>,
};

describe('enum contract', () => {
  it('every domain option list matches its database enum', () => {
    expect(Object.values(contract).every(Boolean)).toBe(true);
  });
});
