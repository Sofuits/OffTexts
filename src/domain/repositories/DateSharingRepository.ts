import type { DayKey, OtherMemberDates } from '@/domain/entities';
import type { Result } from './Result';

/**
 * The other member's free dates.
 *
 * PLACEHOLDER IN EVERY BUILD, for now. Real date sharing needs the scheduling
 * tables and their row-level security (docs/design/scheduling-flow.md, §2–§4),
 * which do not exist yet, so the only implementation is in memory and invents
 * the other member's dates on the phone. It answers `isPlaceholder: true`, and
 * the screens show that. It is not wired to Supabase, deliberately: a Supabase
 * class returning invented data would be a lie with a real-looking name.
 *
 * Not `availability`: `public.availability` is a member's recurring weekly
 * windows for matching, a different question (see the spec, §0).
 */
export interface DateSharingRepository {
  /**
   * The other member's dates, given the dates I have marked. The placeholder
   * uses mine to invent a plausible overlap; the real one will ignore them and
   * read what the other person actually chose.
   */
  theirDates(mine: DayKey[]): Promise<Result<OtherMemberDates>>;
}
