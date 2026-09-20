import type { Meet } from '@/domain/entities';
import {
  AppError,
  failure,
  type MeetRepository,
  type MeetRequest,
  type Result,
} from '@/domain/repositories';

/**
 * Requests a meet with someone, after checking the request makes sense.
 *
 * A slot in the past is the failure worth guarding: the picker defaults to
 * today, a member fills in the form slowly, and by the time they submit, the
 * earliest option has passed. Catching it here gives a clear message instead of
 * a confusing server rejection.
 */
export class RequestMeet {
  static readonly MIN_SLOTS = 1;
  static readonly MAX_SLOTS = 5;

  constructor(private readonly meets: MeetRepository) {}

  async execute(request: MeetRequest, now: Date = new Date()): Promise<Result<Meet>> {
    const future = request.availableSlots.filter((slot) => slot.getTime() > now.getTime());

    if (future.length < RequestMeet.MIN_SLOTS) {
      return failure(
        new AppError('validation', 'Choose at least one time in the future.', {
          field: 'availableSlots',
        }),
      );
    }

    if (future.length > RequestMeet.MAX_SLOTS) {
      return failure(
        new AppError('validation', `Choose at most ${RequestMeet.MAX_SLOTS} times.`, {
          field: 'availableSlots',
        }),
      );
    }

    // Soonest first, so the matching service reads them in preference order.
    const slots = [...future].sort((a, b) => a.getTime() - b.getTime());

    return this.meets.requestMeet({ ...request, availableSlots: slots });
  }
}
