import { DEFAULT_PREFERENCES, EMPTY_PROFILE_DETAILS, type Person } from '@/domain/entities';
import {
  backWhileEditing,
  branchOf,
  nextWhileEditing,
  progressAfterSaving,
} from '@/presentation/screens/onboarding/progress';
import { draftFrom, visibleSteps, type OnboardingDraft } from '@/presentation/screens/onboarding';

/**
 * The two rules that decide where a member resumes and where continue goes
 * while editing from the preview. Pure functions, so tested without a screen.
 */

const PERSON: Person = {
  id: 'person-1',
  name: 'Saksham',
  headline: '',
  city: 'Pune',
  photoUrls: [],
  interests: [],
  intents: ['dating'],
  verification: 'unverified',
};

const draftFor = (update: Partial<OnboardingDraft> = {}): OnboardingDraft => ({
  ...draftFrom(PERSON, EMPTY_PROFILE_DETAILS, DEFAULT_PREFERENCES),
  occupationStatus: 'working',
  ...update,
});

const keys = (draft: OnboardingDraft) => visibleSteps(draft).map((step) => step.key);

describe('progressAfterSaving', () => {
  it('moves forward as steps are saved', () => {
    const draft = draftFor();
    const steps = visibleSteps(draft);
    const at = keys(draft).indexOf('lifestyle');

    const next = progressAfterSaving(steps, at, draft, {
      key: 'languages',
      branch: branchOf(draft),
    });

    expect(next.key).toBe('lifestyle');
  });

  it('does not move back when an earlier step is saved again', () => {
    const draft = draftFor();
    const steps = visibleSteps(draft);
    const at = keys(draft).indexOf('lifestyle');

    const next = progressAfterSaving(steps, at, draft, {
      key: 'notifications',
      branch: branchOf(draft),
    });

    expect(next.key).toBe('notifications');
  });

  it('starts again from the changed step when the purpose changes', () => {
    const before = draftFor();
    const after = draftFor({ purpose: 'co_founder' });
    const steps = visibleSteps(after);

    const next = progressAfterSaving(steps, keys(after).indexOf('purpose'), after, {
      key: 'notifications',
      branch: branchOf(before),
    });

    // The co-founder questions have never been seen; resuming past them
    // would skip questions that are now required.
    expect(next.key).toBe('purpose');
  });

  it('starts again from the changed step when the status changes', () => {
    const before = draftFor({ occupationStatus: 'working' });
    const after = draftFor({ occupationStatus: 'studying' });
    const steps = visibleSteps(after);

    const next = progressAfterSaving(steps, keys(after).indexOf('status'), after, {
      key: 'notifications',
      branch: branchOf(before),
    });

    expect(next.key).toBe('status');
  });
});

describe('editing a section from the preview', () => {
  it('walks every step of the section, then returns to the preview', () => {
    const draft = draftFor({ occupationStatus: 'both' });
    const steps = visibleSteps(draft);
    const order = keys(draft);
    const preview = order.indexOf('preview');

    // Education & work is four steps for somebody working and studying.
    expect(nextWhileEditing(steps, order.indexOf('status'))).toBe(order.indexOf('education'));
    expect(nextWhileEditing(steps, order.indexOf('education'))).toBe(order.indexOf('studies'));
    expect(nextWhileEditing(steps, order.indexOf('studies'))).toBe(order.indexOf('work'));
    expect(nextWhileEditing(steps, order.indexOf('work'))).toBe(preview);
  });

  it('goes back within the section, and to the preview from its first step', () => {
    const draft = draftFor();
    const steps = visibleSteps(draft);
    const order = keys(draft);

    expect(backWhileEditing(steps, order.indexOf('prompts'))).toBe(order.indexOf('intro'));
    expect(backWhileEditing(steps, order.indexOf('interests'))).toBe(order.indexOf('preview'));
  });

  it('treats the category questions as one section', () => {
    const draft = draftFor({ purpose: 'life_partner' });
    const steps = visibleSteps(draft);
    const order = keys(draft);

    expect(nextWhileEditing(steps, order.indexOf('marriageBasics'))).toBe(
      order.indexOf('familyFaith'),
    );
    expect(nextWhileEditing(steps, order.indexOf('familyFaith'))).toBe(order.indexOf('preview'));
  });
});
