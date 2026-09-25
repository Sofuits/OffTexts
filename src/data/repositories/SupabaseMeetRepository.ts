import type { Meet, MeetId } from '@/domain/entities';
import {
  AppError,
  attempt,
  success,
  type MeetingRequest,
  type MeetRepository,
  type Result,
} from '@/domain/repositories';
import type { MeetLocalDataSource } from '@/data/datasources/local';
import { toMeet } from '@/data/mappers';
import type { Logger } from '@/infrastructure/logging';
import type { ConnectivityMonitor } from '@/infrastructure/network';
import { classifySupabaseError } from '@/infrastructure/supabase/supabaseErrors';
import type { TypedSupabaseClient } from '@/infrastructure/supabase/supabaseClient';

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
      await this.requireUserId();

      // The contract's view, not the table: it resolves the other member for
      // the caller, whichever side of the booking they are on. See toMeet.
      const { data, error } = await this.client
        .schema('api_v1')
        .from('meetings')
        .select('*')
        .order('scheduled_for', { ascending: false });

      if (error) throw error;

      return (data ?? []).map(toMeet);
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
      await this.requireUserId();
      return this.readMeeting(id);
    }, classifySupabaseError);
  }

  /**
   * Books a table, through the contract's RPC.
   *
   * NOT an insert. `api_v1.request_meeting` does four things a client cannot:
   * it resolves the other member from the match under the caller's own RLS
   * (so a match you are not in simply is not found, and the error cannot tell
   * the two cases apart), it reads the booking fee at this instant and writes
   * it onto the row so a later price change cannot reprice a booking somebody
   * already made, it refuses a time in the past, and it does all of that in one
   * transaction.
   *
   * Writing this as an insert would mean the app deciding who the other member
   * is and what the fee was — two things it has no business deciding, and one
   * of them a number the member pays.
   */
  async requestMeeting(request: MeetingRequest): Promise<Result<MeetId>> {
    return attempt(async () => {
      const { data, error } = await this.client.schema('api_v1').rpc('request_meeting', {
        p_match_id: request.matchId,
        p_cafe_id: request.venueId,
        p_scheduled_for: request.scheduledFor.toISOString(),
        ...(request.durationMinutes ? { p_duration_minutes: request.durationMinutes } : {}),
      });

      if (error) throw error;
      if (!data) {
        throw new AppError('server', 'The booking did not go through. Try again in a moment.');
      }

      return data;
    }, classifySupabaseError);
  }

  async cancelMeet(id: string): Promise<Result<Meet>> {
    const result = await attempt(async () => {
      await this.requireUserId();

      const { error } = await this.client
        .from('meets')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;

      // Read back through the view, so the result names the other member.
      return this.readMeeting(id);
    }, classifySupabaseError);

    // The cached list now disagrees with the server. Drop it rather than patch
    // it — a stale cancelled meet showing as confirmed is worse than a refetch.
    if (result.ok) await this.cache.clear();
    return result;
  }

  /** One meeting, through the view. Throws PGRST116 (notFound) when it is not the caller's. */
  private async readMeeting(id: string): Promise<Meet> {
    const { data, error } = await this.client
      .schema('api_v1')
      .from('meetings')
      .select('*')
      .eq('meeting_id', id)
      .single();

    if (error) throw error;
    return toMeet(data);
  }
}
