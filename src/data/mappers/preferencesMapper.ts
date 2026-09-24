import {
  DEFAULT_PREFERENCES,
  GENDERS,
  MEET_INTENTS,
  type Gender,
  type MeetIntent,
  type Preferences,
  type PreferencesUpdate,
} from '@/domain/entities';
import type {
  MyPreferencesRow,
  PreferencesRow,
  PreferencesUpdate as PreferencesUpdateRow,
} from '@/infrastructure/supabase/rows';

/**
 * Preferences rows into the entity.
 *
 * Takes either shape — the `api_v1.my_preferences` view or the `preferences`
 * table — because reads go through the contract and writes come back from the
 * table, and the two differ only in nullability. One mapper for both means
 * there is one place where "empty array means no preference" is decided.
 */

const isGender = (value: string): value is Gender => (GENDERS as readonly string[]).includes(value);
const isMeetIntent = (value: string): value is MeetIntent =>
  (MEET_INTENTS as readonly string[]).includes(value);

type EitherRow = MyPreferencesRow | PreferencesRow;

export function toPreferences(row: EitherRow): Preferences {
  return {
    ageMin: row.age_min ?? DEFAULT_PREFERENCES.ageMin,
    ageMax: row.age_max ?? DEFAULT_PREFERENCES.ageMax,
    interestedIn: (row.interested_in ?? []).filter(isGender),
    intents: (row.intents ?? []).filter(isMeetIntent),
    cities: row.cities ?? [],
    pushEnabled: row.push_enabled ?? true,
    emailEnabled: row.email_enabled ?? true,
  };
}

/**
 * Only the fields actually being changed.
 *
 * `undefined` means "leave it alone" — sending every field on every save would
 * make two screens editing different halves of the preferences overwrite each
 * other with whatever they happened to be holding.
 */
export function toPreferencesUpdateRow(update: PreferencesUpdate): PreferencesUpdateRow {
  const row: PreferencesUpdateRow = {};
  if (update.ageMin !== undefined) row.age_min = update.ageMin;
  if (update.ageMax !== undefined) row.age_max = update.ageMax;
  if (update.interestedIn !== undefined) row.interested_in = update.interestedIn;
  if (update.intents !== undefined) row.intents = update.intents;
  if (update.cities !== undefined) row.cities = update.cities;
  if (update.pushEnabled !== undefined) row.push_enabled = update.pushEnabled;
  if (update.emailEnabled !== undefined) row.email_enabled = update.emailEnabled;
  return row;
}
