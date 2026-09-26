import { toProfileDetails, toProfileDetailsRow } from '@/data/mappers';
import type { ProfileDetailsRow } from '@/infrastructure/supabase/rows';

const ROW: ProfileDetailsRow = {
  member_id: 'person-1',
  last_name: 'Kulkarni',
  pronouns: null,
  hometown: 'Nashik',
  languages: ['English', 'Marathi'],
  occupation_status: 'working',
  education_level: 'bachelors',
  institution: null,
  degree: null,
  field_of_study: null,
  graduation_year: 2019,
  study_year: null,
  study_mode: null,
  previous_education: null,
  internship: null,
  career_interests: [],
  skills: [],
  occupation: null,
  job_title: 'Designer',
  company: 'Acme',
  industry: null,
  years_experience: 4,
  work_location: null,
  work_mode: 'hybrid',
  smoking: 'never',
  drinking: null,
  diet: null,
  exercise: null,
  sleep: null,
  pets: null,
  prompts: [{ key: 'perfect_weekend', answer: 'A long walk.' }],
  relationship_goal: null,
  children_plan: 'want',
  partner_values: ['kindness', 'humour'],
  marriage_timeline: 'within_1_year',
  marital_status: 'never_married',
  religion: 'jain',
  faith_importance: null,
  living_arrangement: null,
  family_involvement: 'family_involved',
  open_to_relocate: null,
  cofounder_role: null,
  startup_stage: null,
  founder_skills: [],
  seeking_skills: [],
  founder_commitment: null,
  startup_industries: [],
  funding_plan: null,
  hidden_fields: ['last_name', 'company', 'religion'],
  onboarding_step: 'work',
  created_at: '2026-09-26T00:00:00Z',
  updated_at: '2026-09-26T00:00:00Z',
};

describe('profile details mapper', () => {
  it('reads a row, leaving unanswered questions absent rather than null', () => {
    const details = toProfileDetails(ROW);

    expect(details).toMatchObject({
      lastName: 'Kulkarni',
      graduationYear: 2019,
      workMode: 'hybrid',
      smoking: 'never',
      hiddenFields: ['lastName', 'company', 'religion'],
      onboardingStep: 'work',
      prompts: [{ key: 'perfect_weekend', answer: 'A long walk.' }],
    });
    expect(details).not.toHaveProperty('pronouns');
    expect(details).not.toHaveProperty('drinking');
  });

  it('reads the category answers', () => {
    const details = toProfileDetails(ROW);

    expect(details).toMatchObject({
      childrenPlan: 'want',
      partnerValues: ['kindness', 'humour'],
      marriageTimeline: 'within_1_year',
      maritalStatus: 'never_married',
      religion: 'jain',
      familyInvolvement: 'family_involved',
      founderSkills: [],
    });
    expect(details).not.toHaveProperty('relationshipGoal');
  });

  it('drops skills and values this build does not know', () => {
    const details = toProfileDetails({
      ...ROW,
      partner_values: ['kindness', 'wealth'],
      seeking_skills: ['sales', 'telepathy'] as ProfileDetailsRow['seeking_skills'],
    });

    expect(details.partnerValues).toEqual(['kindness']);
    expect(details.seekingSkills).toEqual(['sales']);
  });

  it('writes category answers, clearing with null, and stores religion as hideable', () => {
    const row = toProfileDetailsRow({
      cofounderRole: 'want_to_join',
      startupStage: null,
      seekingSkills: ['engineering', 'design'],
      hiddenFields: ['lastName', 'religion'],
    });

    expect(row).toEqual({
      cofounder_role: 'want_to_join',
      startup_stage: null,
      seeking_skills: ['engineering', 'design'],
      hidden_fields: ['last_name', 'religion'],
    });
  });

  it('ignores values this build does not know, instead of failing the whole profile', () => {
    const details = toProfileDetails({
      ...ROW,
      smoking: 'vapes' as ProfileDetailsRow['smoking'],
      prompts: [
        { key: 'unknown', answer: 'x' },
        'nonsense',
        { key: 'talk_for_hours', answer: 'Cricket' },
      ],
    });

    expect(details).not.toHaveProperty('smoking');
    expect(details.prompts).toEqual([{ key: 'talk_for_hours', answer: 'Cricket' }]);
  });

  it('writes only what changed, turns blanks into null, and stores hidden fields by column', () => {
    const row = toProfileDetailsRow({
      lastName: '  ',
      company: ' Acme ',
      hiddenFields: ['workLocation'],
      graduationYear: null,
    });

    expect(row).toEqual({
      last_name: null,
      company: 'Acme',
      hidden_fields: ['work_location'],
      graduation_year: null,
    });
  });
});

/**
 * Every column, answered. Typed as the generated row, so a column added by a
 * migration makes this stop compiling until it is filled in — and then the
 * round trip below fails until the mapper handles it in both directions.
 */
const EVERY_COLUMN: ProfileDetailsRow = {
  member_id: 'person-1',
  last_name: 'Kulkarni',
  pronouns: 'he/him',
  hometown: 'Nashik',
  languages: ['English', 'Marathi'],
  occupation_status: 'both',
  education_level: 'masters',
  institution: 'COEP',
  degree: 'M.Tech',
  field_of_study: 'Computer science',
  graduation_year: 2027,
  study_year: 2,
  study_mode: 'part_time',
  previous_education: 'B.E.',
  internship: 'Intern at a studio',
  career_interests: ['Design'],
  skills: ['Figma'],
  occupation: 'Designer',
  job_title: 'Product designer',
  company: 'Acme',
  industry: 'Technology',
  years_experience: 4,
  work_location: 'Baner',
  work_mode: 'remote',
  smoking: 'never',
  drinking: 'socially',
  diet: 'vegetarian',
  exercise: 'daily',
  sleep: 'early_bird',
  pets: 'want_pets',
  prompts: [{ key: 'talk_for_hours', answer: 'Cricket.' }],
  relationship_goal: 'long_term',
  children_plan: 'open',
  partner_values: ['honesty'],
  marriage_timeline: 'two_to_three_years',
  marital_status: 'divorced',
  religion: 'parsi',
  faith_importance: 'somewhat',
  living_arrangement: 'on_our_own',
  family_involvement: 'my_decision',
  open_to_relocate: 'maybe',
  cofounder_role: 'have_startup',
  startup_stage: 'launched',
  founder_skills: ['design'],
  seeking_skills: ['engineering', 'sales'],
  founder_commitment: 'full_time_soon',
  startup_industries: ['Climate'],
  funding_plan: 'bootstrapping',
  hidden_fields: ['last_name', 'hometown', 'institution', 'company', 'work_location', 'religion'],
  onboarding_step: 'preview',
  created_at: '2026-09-26T00:00:00Z',
  updated_at: '2026-09-26T00:00:00Z',
};

describe('profile details mapper, every column', () => {
  it('maps every column there and back without losing one', () => {
    const { member_id: _id, created_at: _created, updated_at: _updated, ...columns } = EVERY_COLUMN;

    expect(toProfileDetailsRow(toProfileDetails(EVERY_COLUMN))).toEqual(columns);
  });
});
