import type { Meet, MeetId, PersonId } from '@/domain/entities';
import type { Result } from './Result';

export type MeetRequest = {
  personId: PersonId;
  /** Times the requester is free. The matching service picks one. */
  availableSlots: Date[];
};

/**
 * Booked meets.
 *
 * `listMeets` returns everything rather than offering `listUpcoming` and
 * `listHistory`. Splitting the two belongs in the domain (`isUpcoming`), not in
 * the query: one fetch, one cache entry, and a rule that cannot disagree with
 * itself between two endpoints.
 */
export interface MeetRepository {
  listMeets(): Promise<Result<Meet[]>>;

  getMeetById(id: MeetId): Promise<Result<Meet>>;

  requestMeet(request: MeetRequest): Promise<Result<Meet>>;

  cancelMeet(id: MeetId, reason?: string): Promise<Result<Meet>>;
}
