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
import { classifySupabaseError, type TypedSupabaseClient } from '@/infrastructure/supabase';

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
        .eq('user_id', userId)
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
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) throw error;
      return toPerson(data);
    }, classifySupabaseError);

    // Keep the cache in step, or the next offline read serves stale values.
    if (result.ok) await this.cache.write(result.value);
    return result;
  }

  async uploadPhoto(localUri: string): Promise<Result<string>> {
    return attempt(async () => {
      const userId = await this.currentUserId();
      if (!userId) throw new AppError('unauthenticated', 'You are not signed in.');

      // React Native's fetch can read a file:// URI into a Blob. FormData would
      // also work; Blob keeps the Supabase call the same as it is on web.
      const response = await fetch(localUri);
      const blob = await response.blob();

      const extension = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${userId}/${Date.now()}.${extension}`;

      const { error } = await this.client.storage
        .from('profile-photos')
        .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });

      if (error) throw error;

      // A public bucket gives a stable URL. If the bucket is made private, this
      // becomes createSignedUrl and the URL expires — which is a repository
      // change only, because callers just receive a string.
      const { data } = this.client.storage.from('profile-photos').getPublicUrl(path);
      return data.publicUrl;
    }, classifySupabaseError);
  }

  /** Not on the interface. Called on sign-out to drop the cached profile. */
  async clearCache(): Promise<Result<void>> {
    await this.cache.clear();
    return success(undefined);
  }
}
