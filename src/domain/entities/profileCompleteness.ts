import type { Person } from './Person';
import { MIN_PHOTOS } from './Photo';
import { isStudying, isWorking, type ProfileDetails } from './ProfileDetails';

/**
 * How finished a profile is, and what would finish it.
 *
 * Not a gate — `complete_my_onboarding()` decides what is required, and this
 * never blocks anything. It is the nudge: the preview at the end of
 * onboarding shows the list, so a member who skipped the optional steps knows
 * which two minutes would do the most for them.
 *
 * In the domain because the profile screen and the admin portal will want the
 * same number, and two versions of "how complete" disagree within a week.
 */

export type CompletenessItem = {
  key: string;
  /** What to do, phrased as the thing to add. */
  label: string;
  done: boolean;
};

export type Completeness = {
  /** 0–100, whole numbers. */
  percent: number;
  items: CompletenessItem[];
  missing: CompletenessItem[];
};

export function profileCompleteness(
  person: Person,
  details: ProfileDetails,
  photoCount: number,
): Completeness {
  const lifestyleAnswered = [
    details.smoking,
    details.drinking,
    details.diet,
    details.exercise,
    details.sleep,
    details.pets,
  ].filter((answer) => answer !== undefined).length;

  const items: CompletenessItem[] = [
    { key: 'photos', label: `Add at least ${MIN_PHOTOS} photos`, done: photoCount >= MIN_PHOTOS },
    { key: 'morePhotos', label: 'Add a few more photos', done: photoCount >= 4 },
    { key: 'intro', label: 'Write a short introduction', done: Boolean(person.bio?.trim()) },
    { key: 'prompts', label: 'Answer two prompts', done: details.prompts.length >= 2 },
    { key: 'interests', label: 'Pick a few interests', done: person.interests.length >= 3 },
    { key: 'languages', label: 'Add the languages you speak', done: details.languages.length > 0 },
    { key: 'education', label: 'Add your education', done: details.educationLevel !== undefined },
    { key: 'lifestyle', label: 'Answer a few lifestyle questions', done: lifestyleAnswered >= 3 },
    { key: 'hometown', label: 'Add your hometown', done: Boolean(details.hometown) },
  ];

  // Only asked of the people it applies to. Counting "add your job" against a
  // student would make a complete profile impossible for them.
  if (isWorking(details.occupationStatus)) {
    items.push({
      key: 'work',
      label: 'Add what you do for work',
      done: Boolean(details.jobTitle || details.occupation),
    });
  }
  if (isStudying(details.occupationStatus)) {
    items.push({
      key: 'studies',
      label: 'Add where you study',
      done: Boolean(details.institution || details.degree),
    });
  }

  const done = items.filter((item) => item.done).length;

  return {
    percent: Math.round((done / items.length) * 100),
    items,
    missing: items.filter((item) => !item.done),
  };
}
