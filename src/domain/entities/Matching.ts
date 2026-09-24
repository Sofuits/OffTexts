import type { Person, PersonId } from './Person';

/**
 * The matching loop: who you are shown, what you decide, and who you match with.
 *
 * Three ideas that only make sense together, so they live in one file rather
 * than three. The rule that shapes all of them: **a member may never learn that
 * somebody liked them unless they liked back.** There is no "who liked me" type
 * here and there must not be one — the database policy that makes it true is in
 * migration 0009, and this file is the client-side half of the same promise.
 */

/**
 * Self-described, not inferred, and including a decline option — declining is a
 * real answer and has to be expressible, or the form makes people lie.
 */
export const GENDERS = ['woman', 'man', 'non_binary', 'other', 'prefer_not_to_say'] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  woman: 'Woman',
  man: 'Man',
  non_binary: 'Non-binary',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

/**
 * The genders a member is open to meeting.
 *
 * Deliberately excludes `prefer_not_to_say`: it is an answer about yourself, not
 * a group of people you could be shown.
 */
export const PREFERABLE_GENDERS = ['woman', 'man', 'non_binary', 'other'] as const;

/** Plural, for "who would you like to meet". */
export const GENDER_PLURAL_LABELS: Record<(typeof PREFERABLE_GENDERS)[number], string> = {
  woman: 'Women',
  man: 'Men',
  non_binary: 'Non-binary people',
  other: 'Everyone else',
};

export type DecisionKind = 'pass' | 'like';

export type CandidateId = string;

/**
 * One person in today's set.
 *
 * `myDecision` is what lets a member close the app half-way through and come
 * back to where they were, rather than being shown the same face twice.
 *
 * Note what is absent: no score, no reason. The database records both — an
 * admin answering "why was I shown this person" needs them — but showing
 * somebody the arithmetic behind a recommendation is corrosive, so the contract
 * does not return them and this type has nowhere to put them.
 */
export type Candidate = {
  id: CandidateId;
  /** Which day's set this belongs to, as an ISO date. */
  forDate: string;
  /** 1 is shown first. */
  slot: number;
  person: Person;
  myDecision: DecisionKind | null;
};

/** Today's set, and whether there is anything left to do in it. */
export type CandidateSet = {
  forDate: string;
  candidates: Candidate[];
};

export function undecided(set: CandidateSet): Candidate[] {
  return set.candidates.filter((candidate) => candidate.myDecision === null);
}

export type MatchId = string;
export type MatchStatus = 'active' | 'closed';

/**
 * A mutual like.
 *
 * `person` is always **the other one**. The database stores a match as an
 * unordered pair precisely so that neither side is "the requester", and this
 * type keeps that promise by never exposing both — a client that had to work
 * out which of two members it was looking at would get it wrong eventually.
 */
export type Match = {
  id: MatchId;
  person: Person;
  matchedAt: Date;
  status: MatchStatus;
  /** How many meetings have been arranged from this match. */
  meetingCount: number;
};

/** What a decision produced. A match, or nothing yet. */
export type DecisionOutcome = {
  kind: DecisionKind;
  subjectId: PersonId;
  /** Set only when this decision completed a mutual like. */
  match: Match | null;
};
