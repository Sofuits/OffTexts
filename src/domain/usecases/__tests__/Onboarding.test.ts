import {
  DEFAULT_PREFERENCES,
  EMPTY_PROFILE_DETAILS,
  profileCompleteness,
  visibleToOthers,
  type Person,
  type Photo,
  type ProfileDetails,
  type ProfileDetailsUpdate,
} from '@/domain/entities';
import {
  success,
  type PhotoRepository,
  type PreferencesRepository,
  type ProfileDetailsRepository,
  type ProfileRepository,
} from '@/domain/repositories';
import { CompleteOnboarding, SaveOnboardingStep } from '@/domain/usecases';

const PERSON: Person = {
  id: 'person-1',
  name: 'Saksham',
  headline: '',
  bio: 'Designs for a fintech and runs on weekends.',
  city: 'Pune',
  dateOfBirth: '1999-04-12',
  gender: 'man',
  photoUrls: [],
  interests: ['Coffee', 'Books', 'Startups'],
  intents: ['dating'],
  verification: 'unverified',
};

// PERSON is here for dating, so a finished profile has a relationship goal.
const DETAILS: ProfileDetails = {
  ...EMPTY_PROFILE_DETAILS,
  occupationStatus: 'working',
  relationshipGoal: 'long_term',
};

function recording() {
  const calls: string[] = [];
  const detailWrites: ProfileDetailsUpdate[] = [];

  const profiles: ProfileRepository = {
    getMyProfile: async () => success(PERSON),
    getProfileById: async () => success(PERSON),
    updateMyProfile: async (update) => {
      calls.push('profile');
      return success({ ...PERSON, ...update } as Person);
    },
    completeMyOnboarding: async () => {
      calls.push('complete');
      return success({ ...PERSON, onboardingCompletedAt: 'now' });
    },
  };
  const details: ProfileDetailsRepository = {
    getMyDetails: async () => success(DETAILS),
    updateMyDetails: async (update) => {
      calls.push('details');
      detailWrites.push(update);
      return success(DETAILS);
    },
    getDetailsFor: async () => success(null),
  };
  const preferences: PreferencesRepository = {
    getMyPreferences: async () => success(DEFAULT_PREFERENCES),
    updateMyPreferences: async () => {
      calls.push('preferences');
      return success(DEFAULT_PREFERENCES);
    },
  };

  return { profiles, details, preferences, calls, detailWrites };
}

const TODAY = new Date('2026-09-26T12:00:00Z');

describe('SaveOnboardingStep', () => {
  it('writes progress last, so a failed save is not marked done', async () => {
    const repos = recording();
    const save = new SaveOnboardingStep(repos.profiles, repos.details, repos.preferences);

    const result = await save.execute(
      { step: 'location', profile: { city: 'Pune' }, preferences: { cities: ['Pune'] } },
      TODAY,
    );

    expect(result.ok).toBe(true);
    expect(repos.calls).toEqual(['profile', 'preferences', 'details']);
    expect(repos.detailWrites[0]).toEqual({ onboardingStep: 'location' });
  });

  it.each([
    [{ profile: { name: 'S' } }, 'name'],
    [{ profile: { dateOfBirth: '2015-01-01' } }, 'dateOfBirth'],
    [{ profile: { interests: ['Coffee'] } }, 'interests'],
    [{ details: { graduationYear: 1800 } }, 'graduationYear'],
    [{ details: { yearsExperience: 99 } }, 'yearsExperience'],
    [{ details: { company: 'x'.repeat(121) } }, 'company'],
    [
      {
        details: {
          prompts: [
            { key: 'talk_for_hours' as const, answer: 'Cricket' },
            { key: 'talk_for_hours' as const, answer: 'Again' },
          ],
        },
      },
      'prompts',
    ],
    [{ preferences: { ageMin: 40, ageMax: 30 } }, 'ageRange'],
    [
      {
        details: {
          partnerValues: [
            'kindness' as const,
            'humour' as const,
            'ambition' as const,
            'honesty' as const,
          ],
        },
      },
      'partnerValues',
    ],
    [{ details: { startupIndustries: ['a', 'b', 'c', 'd', 'e', 'f'] } }, 'startupIndustries'],
  ])('rejects %j before any write, naming %s', async (save, field) => {
    const repos = recording();
    const useCase = new SaveOnboardingStep(repos.profiles, repos.details, repos.preferences);

    const result = await useCase.execute({ step: 'x', ...save }, TODAY);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe(field);
    expect(repos.calls).toEqual([]);
  });

  it('allows a graduation year a few years ahead, for a student', async () => {
    const repos = recording();
    const useCase = new SaveOnboardingStep(repos.profiles, repos.details, repos.preferences);

    const result = await useCase.execute(
      { step: 'education', details: { graduationYear: 2029 } },
      TODAY,
    );

    expect(result.ok).toBe(true);
  });
});

/**
 * Runs CompleteOnboarding against repositories holding this SAVED state. The
 * use case reads what is saved rather than being handed it, so the test sets
 * up the saved state and nothing else.
 */
async function completeWith(saved: {
  person?: Person;
  details?: ProfileDetails;
  photoCount?: number;
  photos?: Photo[];
}) {
  const person = saved.person ?? PERSON;
  const details = saved.details ?? DETAILS;
  const photos =
    saved.photos ??
    Array.from({ length: saved.photoCount ?? 2 }, (_, index) => photoAt(index, 'pending'));
  const calls: string[] = [];

  const profiles: ProfileRepository = {
    getMyProfile: async () => success(person),
    getProfileById: async () => success(person),
    updateMyProfile: async () => success(person),
    completeMyOnboarding: async () => {
      calls.push('complete');
      return success({ ...person, onboardingCompletedAt: 'now' });
    },
  };
  const detailsRepository: ProfileDetailsRepository = {
    getMyDetails: async () => success(details),
    updateMyDetails: async () => success(details),
    getDetailsFor: async () => success(null),
  };
  const photoRepository: PhotoRepository = {
    listMyPhotos: async () => success(photos),
    addPhoto: async () => success(photoAt(0, 'pending')),
    removePhoto: async () => success(undefined),
    setPhotoOrder: async () => success(undefined),
  };

  const result = await new CompleteOnboarding(
    profiles,
    detailsRepository,
    photoRepository,
  ).execute();
  return { result, calls };
}

function photoAt(index: number, moderation: Photo['moderation']): Photo {
  return {
    id: `photo-${index}`,
    url: `https://example.test/${index}.jpg`,
    storagePath: `person-1/${index}.jpg`,
    sortOrder: index + 1,
    moderation,
    ...(moderation === 'rejected' ? { rejectionReason: 'Blurry' } : {}),
  };
}

describe('CompleteOnboarding', () => {
  it('completes a finished profile', async () => {
    const { result, calls } = await completeWith({});

    expect(result.ok).toBe(true);
    expect(calls).toEqual(['complete']);
  });

  it('does not count a rejected photo towards the two', async () => {
    const { result, calls } = await completeWith({
      photos: [photoAt(0, 'approved'), photoAt(1, 'rejected')],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe('photos');
    expect(calls).toEqual([]);
  });

  it.each([
    [{ person: { ...PERSON, intents: [] } }, 'purpose'],
    [{ person: { ...PERSON, gender: undefined } }, 'gender'],
    [{ details: { ...DETAILS, occupationStatus: undefined } }, 'occupationStatus'],
    [{ person: { ...PERSON, bio: '  ' } }, 'bio'],
    [{ photoCount: 1 }, 'photos'],
    // The category answers each purpose requires — migration 0014's rule.
    [{ details: { ...DETAILS, relationshipGoal: undefined } }, 'relationshipGoal'],
    [
      {
        person: { ...PERSON, intents: ['life_partner'] },
        details: { ...DETAILS, maritalStatus: 'never_married' },
      },
      'marriageTimeline',
    ],
    [
      {
        person: { ...PERSON, intents: ['life_partner'] },
        details: { ...DETAILS, marriageTimeline: 'within_1_year' },
      },
      'maritalStatus',
    ],
    [
      {
        person: { ...PERSON, intents: ['co_founder'] },
        details: { ...DETAILS, founderCommitment: 'part_time', seekingSkills: ['sales'] },
      },
      'cofounderRole',
    ],
    [
      {
        person: { ...PERSON, intents: ['co_founder'] },
        details: { ...DETAILS, cofounderRole: 'either', seekingSkills: ['sales'] },
      },
      'founderCommitment',
    ],
    [
      {
        person: { ...PERSON, intents: ['co_founder'] },
        details: { ...DETAILS, cofounderRole: 'either', founderCommitment: 'part_time' },
      },
      'seekingSkills',
    ],
  ])('refuses %j and says which part is missing (%s)', async (change, field) => {
    // `it.each` widens the table's literal types; the cases are valid saved states.
    const { result, calls } = await completeWith(change as Parameters<typeof completeWith>[0]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe(field);
    expect(calls).toEqual([]);
  });
});

describe('CompleteOnboarding, per purpose', () => {
  it.each([
    [
      'life_partner' as const,
      { marriageTimeline: 'not_sure' as const, maritalStatus: 'divorced' as const },
    ],
    [
      'co_founder' as const,
      {
        cofounderRole: 'have_startup' as const,
        founderCommitment: 'full_time_now' as const,
        seekingSkills: ['engineering' as const],
      },
    ],
  ])(
    'completes a finished %s profile without asking for dating answers',
    async (intent, answers) => {
      const { result } = await completeWith({
        person: { ...PERSON, intents: [intent] },
        details: { ...EMPTY_PROFILE_DETAILS, occupationStatus: 'working', ...answers },
      });

      expect(result.ok).toBe(true);
    },
  );
});

describe('profile rules', () => {
  it('removes exactly the hidden answers from what others see', () => {
    const shown = visibleToOthers(
      {
        ...EMPTY_PROFILE_DETAILS,
        lastName: 'Kulkarni',
        company: 'Acme',
        jobTitle: 'Designer',
        hiddenFields: ['lastName', 'company'],
      },
      ['dating'],
    );

    expect(shown.lastName).toBeUndefined();
    expect(shown.company).toBeUndefined();
    expect(shown.jobTitle).toBe('Designer');
  });

  it('keeps religion hidden unless shown, and shows only the current purpose’s answers', () => {
    const answers: ProfileDetails = {
      ...EMPTY_PROFILE_DETAILS,
      relationshipGoal: 'long_term',
      religion: 'sikh',
      maritalStatus: 'never_married',
      cofounderRole: 'either',
      seekingSkills: ['sales'],
    };

    // Religion is hidden by default.
    const partner = visibleToOthers(answers, ['life_partner']);
    expect(partner.religion).toBeUndefined();
    expect(partner.maritalStatus).toBe('never_married');
    expect(partner.relationshipGoal).toBeUndefined();
    expect(partner.seekingSkills).toEqual([]);

    const shownReligion = visibleToOthers({ ...answers, hiddenFields: [] }, ['life_partner']);
    expect(shownReligion.religion).toBe('sikh');

    const founder = visibleToOthers(answers, ['co_founder']);
    expect(founder.cofounderRole).toBe('either');
    expect(founder.maritalStatus).toBeUndefined();
  });

  it('only counts work against somebody who works', () => {
    const student = profileCompleteness(PERSON, { ...DETAILS, occupationStatus: 'studying' }, 2);
    const worker = profileCompleteness(PERSON, DETAILS, 2);

    expect(student.items.map((item) => item.key)).not.toContain('work');
    expect(student.items.map((item) => item.key)).toContain('studies');
    expect(worker.missing.map((item) => item.key)).toContain('work');
  });

  it('reaches 100 when everything is filled in', () => {
    const full = profileCompleteness(
      PERSON,
      {
        ...DETAILS,
        jobTitle: 'Designer',
        languages: ['English'],
        educationLevel: 'bachelors',
        hometown: 'Nashik',
        smoking: 'never',
        drinking: 'socially',
        diet: 'vegetarian',
        prompts: [
          { key: 'perfect_weekend', answer: 'A long walk.' },
          { key: 'talk_for_hours', answer: 'Cricket.' },
        ],
      },
      4,
    );

    expect(full.percent).toBe(100);
    expect(full.missing).toEqual([]);
  });
});
