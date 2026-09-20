import { isUpcoming, type Meet } from '@/domain/entities';
import type { MeetRepository, Result } from '@/domain/repositories';
import { success } from '@/domain/repositories';

export type ScheduledMeets = {
  /** Soonest first — the next thing the member has to turn up to. */
  upcoming: Meet[];
  /** Most recent first — the last meet is the one they want to review. */
  history: Meet[];
};

/**
 * Splits the member's meets into the two lists the Meets tab shows.
 *
 * This is a use case rather than a repository method because the split is a
 * business rule, not a query: a confirmed meet whose time has passed counts as
 * history even though its status still says confirmed. Putting that rule in the
 * screen would mean re-deriving it in every future client; putting it in the
 * repository would tie a storage concern to a product decision.
 *
 * The two orderings are opposite on purpose, and that is the kind of detail
 * that drifts when each screen sorts for itself.
 */
export class GetScheduledMeets {
  constructor(private readonly meets: MeetRepository) {}

  async execute(now: Date = new Date()): Promise<Result<ScheduledMeets>> {
    const result = await this.meets.listMeets();
    if (!result.ok) return result;

    const upcoming: Meet[] = [];
    const history: Meet[] = [];

    for (const meet of result.value) {
      (isUpcoming(meet, now) ? upcoming : history).push(meet);
    }

    upcoming.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
    history.sort((a, b) => b.scheduledFor.getTime() - a.scheduledFor.getTime());

    return success({ upcoming, history });
  }
}
