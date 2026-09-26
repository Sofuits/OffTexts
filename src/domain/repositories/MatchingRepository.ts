import type {
  CandidateId,
  CandidateSet,
  DecisionKind,
  DecisionOutcome,
  Match,
  MatchId,
  PersonId,
} from '@/domain/entities';
import type { Result } from './Result';

/**
 * The matching loop, as one interface.
 *
 * Candidates, decisions and matches are separate tables in the database and
 * separate screens in the app, but they are one conversation: you are shown
 * people, you answer, and sometimes that produces a match. Splitting them
 * across three repositories would mean a screen holding three dependencies to
 * do one thing.
 *
 * WHAT IS DELIBERATELY ABSENT
 * There is no `getPeopleWhoLikedMe`. The database will not answer that question
 * — the policy on `decisions` admits only their author, and not even staff —
 * and this interface does not ask it. That is the product, not a limitation:
 * mutual matching only means anything if one side cannot see ahead.
 */
export interface MatchingRepository {
  /**
   * Today's set.
   *
   * An empty set is a real answer — "nobody today" — and is different from an
   * error. The database creates the set row even when it has nobody to put in
   * it, precisely so those two cases stay distinguishable.
   */
  getTodaysCandidates(): Promise<Result<CandidateSet>>;

  /**
   * Like or pass.
   *
   * Returns the match when this completed a mutual like, so the screen learns
   * about it from the same round trip rather than polling. The match is created
   * by the database, not here — two people liking each other in the same second
   * is the normal case at any volume, and a client that read-then-wrote would
   * produce two matches or none.
   *
   * Recording the same decision twice is not an error; it replaces the previous
   * answer. Changing a pass to a like is a thing people do.
   */
  recordDecision(
    subjectId: PersonId,
    kind: DecisionKind,
    candidateId?: CandidateId,
  ): Promise<Result<DecisionOutcome>>;

  /** Active matches, newest first. */
  listMatches(): Promise<Result<Match[]>>;

  /**
   * Ends a match.
   *
   * Either side may, and the other is not told who did. Closing is not
   * reversible from here — reopening would need both to agree again, which is
   * what liking each other already was.
   */
  closeMatch(id: MatchId, reason?: string): Promise<Result<void>>;
}
