import type {
  CandidateId,
  CandidateSet,
  DecisionKind,
  DecisionOutcome,
  Match,
  MatchId,
  PersonId,
} from '@/domain/entities';
import { attempt, type MatchingRepository, type Result } from '@/domain/repositories';
import { toCandidate, toMatch } from '@/data/mappers/matchingMapper';
import { classifySupabaseError } from '@/infrastructure/supabase/supabaseErrors';
import type { TypedSupabaseClient } from '@/infrastructure/supabase/supabaseClient';

/**
 * The matching loop, against the published contract.
 *
 * Every read here goes through `api_v1` rather than `public` — `daily_candidates`
 * and `my_matches` instead of the `candidates` and `matches` tables. That is
 * the whole point of having a contract: those two views already resolve the
 * other person, filter to the caller and leave out the scoring, so this class
 * is a mapper rather than a query builder, and a refactor of the physical
 * tables does not reach it.
 *
 * `record_decision` is an RPC because the decision and the match it may create
 * have to be one step. Two people liking each other within the same second is
 * the normal case at any volume, and a client that read-then-wrote would
 * produce two matches or none.
 *
 * NOTE ON `.schema('api_v1')`: this must also be listed under Exposed schemas
 * in the Supabase dashboard. PostgREST refuses an unexposed schema, and the
 * error it returns says the schema must be one of the exposed ones rather than
 * naming the setting — which sends you looking in the wrong place.
 */
export class SupabaseMatchingRepository implements MatchingRepository {
  constructor(private readonly client: TypedSupabaseClient) {}

  private get api() {
    return this.client.schema('api_v1');
  }

  async getTodaysCandidates(): Promise<Result<CandidateSet>> {
    return attempt(async () => {
      const today = isoDate(new Date());

      const { data, error } = await this.api
        .from('daily_candidates')
        .select('*')
        .eq('for_date', today)
        .order('slot', { ascending: true });

      if (error) throw error;

      return {
        forDate: today,
        // An empty array is a real answer — "nobody today" — and the screen has
        // a different thing to say for it than for a failure. That is why this
        // does not throw on empty.
        candidates: (data ?? []).map(toCandidate),
      };
    }, classifySupabaseError);
  }

  async recordDecision(
    subjectId: PersonId,
    kind: DecisionKind,
    candidateId?: CandidateId,
  ): Promise<Result<DecisionOutcome>> {
    return attempt(async () => {
      const { data: matchId, error } = await this.api.rpc('record_decision', {
        p_subject_id: subjectId,
        p_kind: kind,
        ...(candidateId ? { p_candidate_id: candidateId } : {}),
      });

      if (error) throw error;

      // Null means "no match yet", which is the common case and not an error.
      if (!matchId) return { kind, subjectId, match: null };

      // Fetch the match itself rather than inventing one from what we already
      // hold. The view resolves the other person's current profile, and the
      // screen is about to show it — building it locally from the candidate
      // would show a stale photo the moment they change it.
      const { data: rows, error: matchError } = await this.api
        .from('my_matches')
        .select('*')
        .eq('match_id', matchId)
        .limit(1);

      if (matchError) throw matchError;

      const row = rows?.[0];
      return { kind, subjectId, match: row ? toMatch(row) : null };
    }, classifySupabaseError);
  }

  async listMatches(): Promise<Result<Match[]>> {
    return attempt(async () => {
      const { data, error } = await this.api
        .from('my_matches')
        .select('*')
        .eq('status', 'active')
        .order('matched_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map(toMatch);
    }, classifySupabaseError);
  }

  async closeMatch(id: MatchId, reason?: string): Promise<Result<void>> {
    return attempt(async () => {
      // Written against `public.matches`, not the contract: `api_v1` is views,
      // and a view is not updatable. The "matches: close own" policy is what
      // permits it, and it pins both members in its WITH CHECK so this cannot
      // reassign the match to somebody else.
      const { error, count } = await this.client
        .from('matches')
        .update(
          {
            status: 'closed',
            closed_at: new Date().toISOString(),
            ...(reason ? { close_reason: reason } : {}),
          },
          { count: 'exact' },
        )
        .eq('id', id);

      if (error) throw error;

      // An UPDATE that RLS forbids does not fail — it matches zero rows and
      // reports success. Without this the button would appear to work and
      // change nothing.
      if (count === 0) {
        throw new Error('That match could not be closed. It may already be closed.');
      }
    }, classifySupabaseError);
  }
}

/** Local calendar date as YYYY-MM-DD. */
function isoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
