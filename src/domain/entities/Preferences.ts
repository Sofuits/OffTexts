import type { Gender } from './Matching';
import type { MeetIntent } from './Person';

/**
 * What a member wants to be shown.
 *
 * Exactly one of these exists per member — the signup trigger creates it — so
 * nothing in the app has to handle "preferences not set up yet". That absence
 * is worth more than it looks: it removes a null check from every screen that
 * reads them.
 *
 * **An empty array means "no preference", not "nobody".** Every query treats it
 * as unfiltered. Representing "no preference" as null instead would need the
 * same rule plus a null check at every call site, and somebody would eventually
 * write the check the other way round and quietly show a member nobody at all.
 */
export type Preferences = {
  ageMin: number;
  ageMax: number;
  /** Genders to be shown. Empty means no preference. */
  interestedIn: Gender[];
  /** Purposes to be shown. Empty means no preference. */
  intents: MeetIntent[];
  /** Cities to look in. Empty means "my own city". */
  cities: string[];
  pushEnabled: boolean;
  emailEnabled: boolean;
};

/** Offtexts' own floor. Younger than this cannot have an account at all. */
export const MIN_AGE = 18;
export const MAX_AGE = 99;

export const DEFAULT_PREFERENCES: Preferences = {
  ageMin: MIN_AGE,
  ageMax: MAX_AGE,
  interestedIn: [],
  intents: [],
  cities: [],
  pushEnabled: true,
  emailEnabled: true,
};

export type PreferencesUpdate = Partial<Preferences>;
