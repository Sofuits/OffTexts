import type { Preferences, PreferencesUpdate } from '@/domain/entities';
import { AppError, attempt, type PreferencesRepository, type Result } from '@/domain/repositories';
import { toPreferences, toPreferencesUpdateRow } from '@/data/mappers/preferencesMapper';
import { classifySupabaseError } from '@/infrastructure/supabase/supabaseErrors';
import type { TypedSupabaseClient } from '@/infrastructure/supabase/supabaseClient';

/**
 * Preferences on Supabase.
 *
 * Reads through the contract (`api_v1.my_preferences`, which is already scoped
 * to the caller) and writes to `public.preferences`, because a view is not
 * updatable. The write is keyed on `auth.uid()` rather than on an id passed in
 * — there is no call shape here that can touch somebody else's row, which is
 * the point.
 */
export class SupabasePreferencesRepository implements PreferencesRepository {
  constructor(private readonly client: TypedSupabaseClient) {}

  async getMyPreferences(): Promise<Result<Preferences>> {
    return attempt(async () => {
      const { data, error } = await this.client
        .schema('api_v1')
        .from('my_preferences')
        .select('*')
        .limit(1);

      if (error) throw error;

      const row = data?.[0];
      // The signup trigger creates this row, so its absence means the member
      // is not signed in — not that they have no preferences. Saying so is
      // more useful than returning defaults and letting the app look like it
      // is working against nothing.
      if (!row) throw new AppError('unauthenticated', 'You are not signed in.');

      return toPreferences(row);
    }, classifySupabaseError);
  }

  async updateMyPreferences(update: PreferencesUpdate): Promise<Result<Preferences>> {
    return attempt(async () => {
      const { data: auth } = await this.client.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new AppError('unauthenticated', 'You are not signed in.');

      const { data, error } = await this.client
        .from('preferences')
        .update(toPreferencesUpdateRow(update))
        .eq('member_id', userId)
        .select('*')
        .single();

      if (error) throw error;
      return toPreferences(data);
    }, classifySupabaseError);
  }
}
