import type { Meet } from '@/domain/entities';
import {
  AppError,
  attempt,
  success,
  type MeetRepository,
  type MeetRequest,
  type Result,
} from '@/domain/repositories';
import type { MeetLocalDataSource } from '@/data/datasources/local';
import { toMeet, type MeetRowWithPerson } from '@/data/mappers';
import type { Logger } from '@/infrastructure/logging';
import type { ConnectivityMonitor } from '@/infrastructure/network';
import { classifySupabaseError, type TypedSupabaseClient } from '@/infrastructure/supabase';

/**
 * Meets on Supabase, with the same offline fallback as profiles.
 *
 * The select joins `profiles` to get the other person's name in one round trip.
 * Without it, a list of five meets is six requests — and on a phone each one is
 * a fresh TLS handshake if the connection has gone idle.
 *
 * `.or()` is used rather than two queries because a meet can have the member on
 * either side, and a union of two result sets would need de-duplicating and
 * re-sorting on the device.
 */
export class SupabaseMeetRepository implements MeetRepository {
  constructor(
    private readonly client: TypedSupabaseClient,
    private readonly cache: MeetLocalDataSource,
    private readonly connectivity: ConnectivityMonitor,
    private readonly logger: Logger,
  ) {}

  private async requireUserId(): Promise<string> {
    const { data } = await this.client.auth.getUser();
    const id = data.user?.id;
    if (!id) throw new AppError('unauthenticated', 'You are not signed in.');
    return id;
  }

  async listMeets(): Promise<Result<Meet[]>> {
    const online = await this.connectivity.getState();

    if (!online.isInternetReachable) {
      const cached = await this.cache.read();
      if (cached) {
        this.logger.info('Serving meets from cache; device is offline.');
        return success(cached);
      }
    }

    const result = await attempt(async () => {
      const userId = await this.requireUserId();

      const { data, error } = await this.client
        .from('meets')
        .select('*, person:profiles!meets_recipient_id_fkey(name, photo_urls)')
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('scheduled_for', { ascending: false });

      if (error) throw error;

      return (data as unknown as MeetRowWithPerson[]).map((row) => toMeet(row, userId));
    }, classifySupabaseError);

    if (result.ok) {
      await this.cache.write(result.value);
      return result;
    }

    if (result.error.kind === 'network') {
      const cached = await this.cache.read();
      if (cached) {
        this.logger.info('Meets request failed; serving cache.');
        return success(cached);
      }
    }

    return result;
  }

  async getMeetById(id: string): Promise<Result<Meet>> {
    return attempt(async () => {
      const userId = await this.requireUserId();

      const { data, error } = await this.client.from('meets').select('*').eq('id', id).single();
      if (error) throw error;

      return toMeet(data as unknown as MeetRowWithPerson, userId);
    }, classifySupabaseError);
  }

  async requestMeet(request: MeetRequest): Promise<Result<Meet>> {
    return attempt(async () => {
      const userId = await this.requireUserId();
      const slot = request.availableSlots[0];
      if (!slot) throw new AppError('validation', 'Choose a time.');

      // Venue selection belongs to the backend: it needs the partner-venue list
      // and both members' locations, neither of which the app should hold.
      const { data, error } = await this.client
        .from('meets')
        .insert({
          requester_id: userId,
          recipient_id: request.personId,
          venue_name: 'To be confirmed',
          venue_area: 'Pune',
          scheduled_for: slot.toISOString(),
          status: 'pending',
        })
        .select('*')
        .single();

      if (error) throw error;
      return toMeet(data as unknown as MeetRowWithPerson, userId);
    }, classifySupabaseError);
  }

  async cancelMeet(id: string): Promise<Result<Meet>> {
    const result = await attempt(async () => {
      const userId = await this.requireUserId();

      const { data, error } = await this.client
        .from('meets')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return toMeet(data as unknown as MeetRowWithPerson, userId);
    }, classifySupabaseError);

    // The cached list now disagrees with the server. Drop it rather than patch
    // it — a stale cancelled meet showing as confirmed is worse than a refetch.
    if (result.ok) await this.cache.clear();
    return result;
  }
}
