import type { OnboardingDraft } from './draft';
import type { StepConfig } from './steps';

/**
 * Where a member has got to, and the two rules that keep it honest.
 *
 * Kept apart from the screen because both rules are easy to get subtly wrong
 * and cheap to test on their own.
 */

/**
 * The saved progress: the furthest step reached, and the answers that decided
 * which steps exist when it was reached.
 */
export type Progress = { key: string | null; branch: string };

/**
 * The answers that add or remove steps. Purpose decides "who would you like
 * to meet" and the category questions; status decides studies and work.
 */
export const branchOf = (draft: OnboardingDraft): string =>
  `${draft.purpose ?? ''}|${draft.occupationStatus ?? ''}`;

/**
 * The progress to save when the step at `index` is saved.
 *
 * Progress only moves forward. Going back to change an earlier answer — from
 * the preview's Edit links, or with the back arrow — must not rewind it, or a
 * member who closes the app there resumes in the middle of the flow and is
 * asked to agree to the guidelines again.
 *
 * The exception is a changed branch. A new purpose or status brings steps the
 * member has never seen; keeping progress past them would let a resumed flow
 * skip straight over questions that now apply.
 */
export function progressAfterSaving(
  steps: StepConfig[],
  index: number,
  draft: OnboardingDraft,
  saved: Progress,
): Progress {
  const current = steps[index];
  const branch = branchOf(draft);
  if (!current) return saved;

  const savedIndex = saved.key ? steps.findIndex((step) => step.key === saved.key) : -1;
  const keep = saved.branch === branch && savedIndex > index;

  return { key: keep ? saved.key : current.key, branch };
}

/**
 * Where continue goes while editing a section from the preview.
 *
 * The rest of that section, then back to the preview — not after one step.
 * "Education & work" is up to four steps, and returning after the first would
 * make the other three unreachable from the preview.
 */
export function nextWhileEditing(steps: StepConfig[], index: number): number {
  const current = steps[index];
  const next = steps[index + 1];
  const preview = steps.findIndex((step) => step.key === 'preview');

  if (current && next && next.section === current.section && next.key !== 'preview') {
    return index + 1;
  }
  return preview >= 0 ? preview : Math.min(index + 1, steps.length - 1);
}

/** Where back goes while editing: the previous step in the section, else the preview. */
export function backWhileEditing(steps: StepConfig[], index: number): number {
  const current = steps[index];
  const previous = steps[index - 1];
  const preview = steps.findIndex((step) => step.key === 'preview');

  if (current && previous && previous.section === current.section) return index - 1;
  return preview >= 0 ? preview : Math.max(index - 1, 0);
}
