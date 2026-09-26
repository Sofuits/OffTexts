import type { PersonId, ProfileDetails, ProfileDetailsUpdate } from '@/domain/entities';
import type { Result } from './Result';

/**
 * The common profile — education, work, lifestyle, prompts.
 *
 * Its own repository rather than more methods on `ProfileRepository`, because
 * it is read differently: the owner reads all of it, and everybody else reads
 * a copy with the hidden answers already removed by the server. Two methods
 * with different names make it impossible to use one where the other was
 * meant.
 *
 * There is no `create`. The first `updateMyDetails` creates the row; a member
 * who has never saved a step simply has none, and `getMyDetails` answers with
 * the empty profile rather than "not found".
 */
export interface ProfileDetailsRepository {
  /** Everything, including hidden answers and onboarding progress. */
  getMyDetails(): Promise<Result<ProfileDetails>>;

  updateMyDetails(update: ProfileDetailsUpdate): Promise<Result<ProfileDetails>>;

  /**
   * Another member's common profile as they have chosen to show it.
   *
   * `null` when there is nothing this member may see — not verified, not
   * finished onboarding, or never filled in. Deliberately not an error: a
   * profile screen with no details section is normal.
   */
  getDetailsFor(id: PersonId): Promise<Result<ProfileDetails | null>>;
}
