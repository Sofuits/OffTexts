import {
  EMPTY_PROFILE_DETAILS,
  type PersonId,
  type ProfileDetails,
  type ProfileDetailsUpdate,
} from '@/domain/entities';
import {
  AppError,
  attempt,
  type ProfileDetailsRepository,
  type Result,
} from '@/domain/repositories';
import {
  toProfileDetails,
  toProfileDetailsRow,
  type SharedProfileDetailsRow,
} from '@/data/mappers/profileDetailsMapper';
import { classifySupabaseError } from '@/infrastructure/supabase/supabaseErrors';
import type { TypedSupabaseClient } from '@/infrastructure/supabase/supabaseClient';

/**
 * The common profile on Supabase.
 *
 * The member's own row is read through `api_v1.my_profile_details` and written
 * to `public.profile_details` — a view cannot be written to. Everybody else's
 * is read through `api_v1.profile_details_for()`, the only route the database
 * offers, which removes hidden answers before they leave the server.
 */
export class SupabaseProfileDetailsRepository implements ProfileDetailsRepository {
  constructor(private readonly client: TypedSupabaseClient) {}

  private async currentUserId(): Promise<string> {
    const { data } = await this.client.auth.getUser();
    const id = data.user?.id;
    if (!id) throw new AppError('unauthenticated', 'You are not signed in.');
    return id;
  }

  async getMyDetails(): Promise<Result<ProfileDetails>> {
    return attempt(async () => {
      const { data, error } = await this.client
        .schema('api_v1')
        .from('my_profile_details')
        .select('*')
        .limit(1);

      if (error) throw error;

      const row = data?.[0];
      // No row yet is normal: it is created by the first onboarding step saved.
      if (!row || row.member_id === null) return { ...EMPTY_PROFILE_DETAILS };

      return toProfileDetails(row as Parameters<typeof toProfileDetails>[0]);
    }, classifySupabaseError);
  }

  async updateMyDetails(update: ProfileDetailsUpdate): Promise<Result<ProfileDetails>> {
    return attempt(async () => {
      const memberId = await this.currentUserId();

      // An upsert, because the row does not exist until the first save. Keyed
      // on the caller's own id; the policy would refuse any other.
      const { data, error } = await this.client
        .from('profile_details')
        .upsert(
          { member_id: memberId, ...toProfileDetailsRow(update) },
          { onConflict: 'member_id' },
        )
        .select('*')
        .single();

      if (error) throw error;
      return toProfileDetails(data);
    }, classifySupabaseError);
  }

  async getDetailsFor(id: PersonId): Promise<Result<ProfileDetails | null>> {
    return attempt(async () => {
      const { data, error } = await this.client
        .schema('api_v1')
        .rpc('profile_details_for', { p_member_id: id });

      if (error) throw error;

      // The generated types cannot describe a function returning a table, so
      // the row shape is asserted here — it is the column list in 0014.
      const row = (data as SharedProfileDetailsRow[] | null)?.[0];
      return row ? toProfileDetails(row) : null;
    }, classifySupabaseError);
  }
}
