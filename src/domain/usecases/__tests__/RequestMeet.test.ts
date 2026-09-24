import { RequestMeet } from '@/domain/usecases';
import {
  AppError,
  failure,
  success,
  type MeetingRequest,
  type MeetRepository,
} from '@/domain/repositories';

/**
 * The rules a booking has to pass before it is worth a round trip.
 *
 * Each of these is also enforced in the database — a client check is a
 * courtesy, never a control — so what is being tested here is the message a
 * member reads, not whether the rule holds. The rule holds either way; the
 * difference is whether they are told "pick a time at least an hour from now"
 * or shown a plpgsql error.
 */

const NOW = new Date('2026-09-24T12:00:00.000Z');
const inHours = (hours: number): Date => new Date(NOW.getTime() + hours * 3_600_000);

/** Records what reached the repository, so "it was not called" is assertable. */
function recording() {
  const seen: MeetingRequest[] = [];
  const repository: MeetRepository = {
    listMeets: async () => success([]),
    getMeetById: async () => failure(new AppError('notFound', 'not used')),
    requestMeeting: async (request) => {
      seen.push(request);
      return success('meet-1');
    },
    cancelMeet: async () => failure(new AppError('notFound', 'not used')),
  };
  return { seen, repository };
}

const request = (overrides: Partial<MeetingRequest> = {}): MeetingRequest => ({
  matchId: 'match-1',
  venueId: 'venue-1',
  scheduledFor: inHours(24),
  ...overrides,
});

describe('RequestMeet', () => {
  it('books a table and returns its id', async () => {
    const { seen, repository } = recording();
    const result = await new RequestMeet(repository).execute(request(), NOW);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('meet-1');
    expect(seen).toHaveLength(1);
  });

  it('fills in the default duration rather than leaving it to the server', async () => {
    const { seen, repository } = recording();
    await new RequestMeet(repository).execute(request(), NOW);

    // Sent explicitly so the booking says how long it is, rather than relying
    // on a database default that could change under it.
    expect(seen[0]?.durationMinutes).toBe(RequestMeet.DEFAULT_DURATION_MINUTES);
  });

  it('refuses a time in the past without asking the server', async () => {
    const { seen, repository } = recording();
    const result = await new RequestMeet(repository).execute(
      request({ scheduledFor: inHours(-1) }),
      NOW,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe('scheduledFor');
    expect(seen).toHaveLength(0);
  });

  it('refuses a time inside the notice period', async () => {
    const { repository } = recording();
    // Half an hour from now, with an hour of notice required. This is the case
    // that actually happens: the form is filled in slowly and the earliest
    // slot goes stale while it is open.
    const result = await new RequestMeet(repository).execute(
      request({ scheduledFor: new Date(NOW.getTime() + 30 * 60_000) }),
      NOW,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('validation');
      expect(result.error.message).toContain(String(RequestMeet.MIN_NOTICE_MINUTES));
    }
  });

  it('accepts a time exactly at the notice boundary', async () => {
    const { repository } = recording();
    const result = await new RequestMeet(repository).execute(
      request({ scheduledFor: new Date(NOW.getTime() + RequestMeet.MIN_NOTICE_MINUTES * 60_000) }),
      NOW,
    );

    expect(result.ok).toBe(true);
  });

  it('refuses a booking with no café', async () => {
    const { seen, repository } = recording();
    const result = await new RequestMeet(repository).execute(request({ venueId: '' }), NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe('venueId');
    expect(seen).toHaveLength(0);
  });

  it('refuses a booking with no match, because only a match permits one', async () => {
    const { seen, repository } = recording();
    const result = await new RequestMeet(repository).execute(request({ matchId: '' }), NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe('matchId');
    expect(seen).toHaveLength(0);
  });

  it('refuses a duration the database would reject', async () => {
    const { repository } = recording();
    const useCase = new RequestMeet(repository);

    const tooShort = await useCase.execute(request({ durationMinutes: 5 }), NOW);
    const tooLong = await useCase.execute(request({ durationMinutes: 600 }), NOW);

    expect(tooShort.ok).toBe(false);
    expect(tooLong.ok).toBe(false);
  });

  it('refuses an unparseable date instead of sending Invalid Date', async () => {
    const { seen, repository } = recording();
    const result = await new RequestMeet(repository).execute(
      request({ scheduledFor: new Date('not a date') }),
      NOW,
    );

    expect(result.ok).toBe(false);
    // `new Date('not a date').toISOString()` throws, so without this check the
    // failure would be a RangeError inside the repository rather than a
    // message.
    expect(seen).toHaveLength(0);
  });
});
