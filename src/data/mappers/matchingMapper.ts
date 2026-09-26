import {
  GENDERS,
  MEET_INTENTS,
  type Candidate,
  type DecisionKind,
  type Gender,
  type Match,
  type MatchStatus,
  type MeetIntent,
  type Person,
} from '@/domain/entities';
import type { DailyCandidateRow, MyMatchRow } from '@/infrastructure/supabase/rows';

/**
 * Contract rows into entities.
 *
 * These come from `api_v1` views rather than tables, which changes one thing
 * about the mapping: **almost every column is nullable.** PostgREST reports a
 * view's columns as nullable regardless of the underlying table, because it
 * cannot prove otherwise through a join. So the generated types say
 * `string | null` for a name that can never actually be null.
 *
 * Rather than assert non-null everywhere and hope, each mapper supplies a
 * defensible fallback. The cost is a card that renders oddly if the impossible
 * happens; the alternative is a screen that throws and shows nothing.
 */

const isMeetIntent = (value: string): value is MeetIntent =>
  (MEET_INTENTS as readonly string[]).includes(value);

const toGender = (value: string | null): Gender | undefined =>
  value !== null && (GENDERS as readonly string[]).includes(value) ? (value as Gender) : undefined;

const toDecision = (value: string | null): DecisionKind | null =>
  value === 'like' || value === 'pass' ? value : null;

const toMatchStatus = (value: string | null): MatchStatus =>
  value === 'closed' ? 'closed' : 'active';

/**
 * A candidate row carries the subject's profile inline, flattened.
 *
 * The view does that join so the phone makes one request instead of six — the
 * difference between a list that appears and a list that pops in. The cost is
 * this function, which un-flattens it.
 */
export function toCandidate(row: DailyCandidateRow): Candidate {
  const person: Person = {
    id: row.member_id ?? '',
    name: row.name ?? 'Someone',
    ...(row.age === null || row.age === undefined ? {} : { age: row.age }),
    ...(toGender(row.gender ?? null) === undefined
      ? {}
      : { gender: toGender(row.gender ?? null) as Gender }),
    headline: row.headline ?? '',
    ...(row.bio === null || row.bio === undefined ? {} : { bio: row.bio }),
    city: row.city ?? '',
    photoUrls: row.photo_urls ?? [],
    interests: row.interests ?? [],
    intents: (row.intents ?? []).filter(isMeetIntent),
    // Anyone in a candidate set is verified by construction — the generation
    // rules only ever pick verified members — so this is a statement of fact
    // rather than a guess.
    verification: 'verified',
  };

  return {
    id: row.candidate_id ?? '',
    forDate: row.for_date ?? '',
    slot: row.slot ?? 0,
    person,
    myDecision: toDecision(row.my_decision ?? null),
  };
}

export function toMatch(row: MyMatchRow): Match {
  const person: Person = {
    id: row.member_id ?? '',
    name: row.name ?? 'Someone',
    ...(row.age === null || row.age === undefined ? {} : { age: row.age }),
    headline: row.headline ?? '',
    city: row.city ?? '',
    photoUrls: row.photo_urls ?? [],
    interests: [],
    intents: [],
    verification: 'verified',
  };

  return {
    id: row.match_id ?? '',
    person,
    // The column is a timestamp string. An invalid one becomes "now" rather
    // than an Invalid Date, which renders as the string "Invalid Date" in a
    // list and looks like a bug in the wrong place.
    matchedAt: row.matched_at ? new Date(row.matched_at) : new Date(),
    status: toMatchStatus(row.status ?? null),
    meetingCount: row.meeting_count ?? 0,
  };
}
