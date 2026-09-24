import type { Preferences, PreferencesUpdate } from '@/domain/entities';
import type { Result } from './Result';

/**
 * What the signed-in member wants to be shown.
 *
 * No `getPreferencesFor(someoneElse)`, and there should never be one. A
 * member's preferences say who they are interested in, which is among the most
 * revealing things the product stores — the database policy admits only their
 * owner, and an interface that implied otherwise would invite somebody to try.
 *
 * There is no `create`. The signup trigger writes the row, so a member always
 * has exactly one and `getMyPreferences` never has to answer "none yet".
 */
export interface PreferencesRepository {
  getMyPreferences(): Promise<Result<Preferences>>;
  updateMyPreferences(update: PreferencesUpdate): Promise<Result<Preferences>>;
}
