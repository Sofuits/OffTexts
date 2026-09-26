import type { Person } from '@/domain/entities';
import {
  AppError,
  attempt,
  success,
  type ProfileRepository,
  type ProfileUpdate,
  type Result,
} from '@/domain/repositories';
import type { ProfileLocalDataSource } from '@/data/datasources/local';
import { toPerson, toProfileUpdateRow } from '@/data/mappers';
import type { Logger } from '@/infrastructure/logging';
import type { ConnectivityMonitor } from '@/infrastructure/network';
import { classifySupabaseError } from '@/infrastructure/supabase/supabaseErrors';
import type { TypedSupabaseClient } from '@/infrastructure/supabase/supabaseClient';

/**
 * Profiles on Supabase, with an offline fallback.
 *
 * The offline behaviour is the interesting part. `getMyProfile` writes every
 * successful read to the local cache, and on a network failure returns the
 * cached copy instead of an error. The member sees their profile on a train;
 * they do not see a spinner and a retry button for data the phone already has.
 *
 * It only falls back for `network` errors. A 403 from a Row Level Security
 * policy must surface — serving cached data over an authorisation failure would
 * show a member something they are no longer allowed to see.
 */
export class SupabaseProfileRepository implements ProfileRepository {
  constructor(
    private readonly client: TypedSupabaseClient,
    private readonly cache: ProfileLocalDataSource,
    private readonly connectivity: ConnectivityMonitor,
    private readonly logger: Logger,
  ) {}

  private async currentUserId(): Promise<string | null> {
    const { data } = await this.client.auth.getUser();
    return data.user?.id ?? null;
  }

  async getMyProfile(): Promise<Result<Person>> {
    const online = await this.connectivity.getState();

    if (!online.isInternetReachable) {
      const cached = await this.cache.read();
      if (cached) {
        this.logger.info('Serving profile from cache; device is offline.');
        return success(cached);
      }
    }

    const result = await attempt(async () => {
      const userId = await this.currentUserId();
      if (!userId) throw new AppError('unauthenticated', 'You are not signed in.');

      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return toPerson(data);
    }, classifySupabaseError);

    if (result.ok) {
      await this.cache.write(result.value);
      return result;
    }

    if (result.error.kind === 'network') {
      const cached = await this.cache.read();
      if (cached) {
        this.logger.info('Profile request failed; serving cache.', { kind: result.error.kind });
        return success(cached);
      }
    }

    return result;
  }

  async getProfileById(id: string): Promise<Result<Person>> {
    return attempt(async () => {
      const { data, error } = await this.client.from('profiles').select('*').eq('id', id).single();
      if (error) throw error;
      return toPerson(data);
    }, classifySupabaseError);
  }

  async updateMyProfile(update: ProfileUpdate): Promise<Result<Person>> {
    const result = await attempt(async () => {
      const userId = await this.currentUserId();
      if (!userId) throw new AppError('unauthenticated', 'You are not signed in.');

      const { data, error } = await this.client
        .from('profiles')
        .update(toProfileUpdateRow(update))
        .eq('id', userId)
        .select('*')
        .single();

      if (error) throw error;
      return toPerson(data);
    }, classifySupabaseError);

    // Keep the cache in step, or the next offline read serves stale values.
    if (result.ok) await this.cache.write(result.value);
    return result;
  }

  async completeMyOnboarding(): Promise<Result<Person>> {
    const result = await attempt(async () => {
      const userId = await this.currentUserId();
      if (!userId) throw new AppError('unauthenticated', 'You are not signed in.');

      const { error: rpcError } = await this.client.schema('api_v1').rpc('complete_my_onboarding');

      if (rpcError) {
        // 22023 is the function saying what is missing, in words written for
        // a member (see migrations 0012 and 0014). Every other failure goes through the
        // usual translation, which does not trust a database's wording.
        if (rpcError.code === '22023') {
          throw new AppError('validation', rpcError.message, { cause: rpcError });
        }
        throw rpcError;
      }

      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return toPerson(data);
    }, classifySupabaseError);

    if (result.ok) await this.cache.write(result.value);
    return result;
  }

  /** Not on the interface. Called on sign-out to drop the cached profile. */
  async clearCache(): Promise<Result<void>> {
    await this.cache.clear();
    return success(undefined);
  }
}
