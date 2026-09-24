import type { Meet } from '@/domain/entities';
import { AppError, failure, success, type MeetRepository } from '@/domain/repositories';
import { GetScheduledMeets } from '@/domain/usecases';

/**
 * Business rules, tested with no React, no network and no Supabase.
 *
 * That this file needs nothing but a plain object implementing an interface is
 * the concrete payoff of the architecture — these tests run in milliseconds and
 * cannot break because of an SDK upgrade.
 */

const NOW = new Date('2026-06-15T12:00:00Z');

const meet = (id: string, offsetHours: number, status: Meet['status']): Meet => ({
  id,
  personId: `person-${id}`,
  personName: `Person ${id}`,
  venueName: 'Cozy Café',
  venueArea: 'Koregaon Park',
  scheduledFor: new Date(NOW.getTime() + offsetHours * 3600_000),
  status,
});

/** A repository that returns whatever the test hands it. */
const repositoryReturning = (meets: Meet[]): MeetRepository => ({
  listMeets: async () => success(meets),
  getMeetById: async () => failure(new AppError('notFound', 'not used')),
  requestMeeting: async () => failure(new AppError('notFound', 'not used')),
  cancelMeet: async () => failure(new AppError('notFound', 'not used')),
});

describe('GetScheduledMeets', () => {
  it('splits meets into upcoming and history', async () => {
    const useCase = new GetScheduledMeets(
      repositoryReturning([meet('future', 48, 'confirmed'), meet('past', -48, 'completed')]),
    );

    const result = await useCase.execute(NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.upcoming.map((m) => m.id)).toEqual(['future']);
    expect(result.value.history.map((m) => m.id)).toEqual(['past']);
  });

  it('treats a confirmed meet whose time has passed as history', async () => {
    // The rule that would be easy to get wrong in a screen: status still says
    // confirmed because nothing has marked it complete yet.
    const useCase = new GetScheduledMeets(repositoryReturning([meet('stale', -2, 'confirmed')]));

    const result = await useCase.execute(NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.upcoming).toHaveLength(0);
    expect(result.value.history.map((m) => m.id)).toEqual(['stale']);
  });

  it('treats a cancelled meet in the future as history', async () => {
    const useCase = new GetScheduledMeets(
      repositoryReturning([meet('called-off', 72, 'cancelled')]),
    );

    const result = await useCase.execute(NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.upcoming).toHaveLength(0);
    expect(result.value.history.map((m) => m.id)).toEqual(['called-off']);
  });

  it('sorts upcoming soonest first and history most recent first', async () => {
    const useCase = new GetScheduledMeets(
      repositoryReturning([
        meet('later', 96, 'confirmed'),
        meet('sooner', 24, 'confirmed'),
        meet('older', -240, 'completed'),
        meet('recent', -24, 'completed'),
      ]),
    );

    const result = await useCase.execute(NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.upcoming.map((m) => m.id)).toEqual(['sooner', 'later']);
    expect(result.value.history.map((m) => m.id)).toEqual(['recent', 'older']);
  });

  it('passes a repository failure through untouched', async () => {
    const useCase = new GetScheduledMeets({
      ...repositoryReturning([]),
      listMeets: async () => failure(new AppError('network', 'No connection.')),
    });

    const result = await useCase.execute(NOW);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('network');
    // A network failure must stay retryable all the way up to the UI.
    expect(result.error.isRetryable).toBe(true);
  });
});
