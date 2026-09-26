import type { MeetId } from '@/domain/entities';
import {
  AppError,
  failure,
  type MeetRepository,
  type MeetingRequest,
  type Result,
} from '@/domain/repositories';

/**
 * Books a table, after checking the booking makes sense.
 *
 * The rules here are the ones the member should learn about before the round
 * trip rather than after it. Each is also enforced in the database — a client
 * check is a courtesy, never a control — but a plpgsql error string is not
 * something to put in front of somebody who just picked a Thursday.
 *
 * The one worth having is the time check. The picker offers today, a member
 * fills in the form slowly, and by the time they tap Confirm the 4pm slot has
 * passed. Without this they get "A meeting cannot be scheduled in the past"
 * from Postgres and have to work out which part of the form it means.
 */
export class RequestMeet {
  /** What the database allows. Mirrors the CHECK on `meets.duration_minutes`. */
  static readonly MIN_DURATION_MINUTES = 15;
  static readonly MAX_DURATION_MINUTES = 480;
  static readonly DEFAULT_DURATION_MINUTES = 60;

  /**
   * Nobody should be able to book a table for two minutes from now. The café
   * has to know, and the other member has to be able to get there.
   */
  static readonly MIN_NOTICE_MINUTES = 60;

  constructor(private readonly meets: MeetRepository) {}

  async execute(request: MeetingRequest, now: Date = new Date()): Promise<Result<MeetId>> {
    if (!request.matchId) {
      return failure(
        new AppError('validation', 'That match is no longer available.', { field: 'matchId' }),
      );
    }

    if (!request.venueId) {
      return failure(new AppError('validation', 'Pick a café first.', { field: 'venueId' }));
    }

    const when = request.scheduledFor.getTime();
    if (Number.isNaN(when)) {
      return failure(new AppError('validation', 'Pick a time.', { field: 'scheduledFor' }));
    }

    const noticeMs = RequestMeet.MIN_NOTICE_MINUTES * 60_000;
    if (when < now.getTime() + noticeMs) {
      return failure(
        new AppError(
          'validation',
          `Pick a time at least ${RequestMeet.MIN_NOTICE_MINUTES} minutes from now, so the café and the other person both have notice.`,
          { field: 'scheduledFor' },
        ),
      );
    }

    const duration = request.durationMinutes ?? RequestMeet.DEFAULT_DURATION_MINUTES;
    if (
      duration < RequestMeet.MIN_DURATION_MINUTES ||
      duration > RequestMeet.MAX_DURATION_MINUTES
    ) {
      return failure(
        new AppError(
          'validation',
          `A meet runs between ${RequestMeet.MIN_DURATION_MINUTES} minutes and ${RequestMeet.MAX_DURATION_MINUTES / 60} hours.`,
          { field: 'durationMinutes' },
        ),
      );
    }

    return this.meets.requestMeeting({ ...request, durationMinutes: duration });
  }
}
