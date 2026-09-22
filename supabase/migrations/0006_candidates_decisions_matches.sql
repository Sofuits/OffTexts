-- =============================================================================
-- Offtexts — daily candidates, decisions, matches
-- =============================================================================
-- The product loop. Each night every active member gets a small set of
-- candidates; they like or pass; two likes make a match; a match can be turned
-- into a meeting.
--
-- THE ONE DESIGN RULE HERE
-- A member must never be able to learn that somebody liked them unless they
-- liked back. Everything below is shaped by that: decisions are readable only
-- by their author, matches are created by a trigger running as the definer
-- rather than by either member, and there is no view anywhere that joins the
-- two. A "who liked me" feature would be one policy away, and that policy is
-- deliberately not written.
-- =============================================================================


-- ----------------------------------------------------------------- enums ----

-- Two values today. A third ('super', 'maybe') is `alter type … add value`,
-- which is cheap; guessing at one now and never using it is not.
create type decision_kind as enum ('pass', 'like');

create type match_status as enum ('active', 'closed');


-- --------------------------------------------------------- candidate sets ---

-- One set per member per day. The set exists even when it is empty — that is
-- a meaningful fact ("we had nobody to show you today") and it is the only way
-- to tell it apart from "the job did not run".
create table public.candidate_sets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,

  for_date date not null,

  -- Which version of the selection rules produced this set.
  --
  -- Recorded because "why am I seeing this person" is a question that gets
  -- asked, usually months later, by which time the rules have changed twice.
  -- Without this the honest answer is "we cannot tell you".
  rule_version text not null check (char_length(rule_version) between 2 and 40),

  generated_at timestamptz not null default now(),

  constraint candidate_sets_one_per_day unique (member_id, for_date),

  -- Lets the child table carry member_id and have the database guarantee the
  -- two never disagree. See the composite foreign key below.
  constraint candidate_sets_id_member unique (id, member_id)
);

comment on table public.candidate_sets is
  'One row per member per day. An empty set means nobody matched, not that the job failed.';

create index candidate_sets_member_idx on public.candidate_sets (member_id, for_date desc);
create index candidate_sets_date_idx on public.candidate_sets (for_date desc);


-- ------------------------------------------------------------- candidates ---

create table public.candidates (
  id uuid primary key default gen_random_uuid(),

  set_id uuid not null references public.candidate_sets (id) on delete cascade,

  -- Denormalised from the set so that the RLS policy is `auth.uid() =
  -- member_id` rather than a subquery into candidate_sets, which Postgres
  -- would evaluate for every row of every read.
  --
  -- The composite foreign key below is what makes the denormalisation safe:
  -- it is not possible to insert a candidate whose member_id disagrees with
  -- its set's. A trigger would have been the other option, and a trigger can
  -- be disabled.
  member_id uuid not null references public.profiles (id) on delete cascade,

  subject_id uuid not null references public.profiles (id) on delete cascade,

  -- 1 = shown first. Called slot rather than rank or position: both of those
  -- are function names in Postgres and both will eventually need quoting in a
  -- place nobody remembers to quote them.
  slot int not null check (slot between 1 and 20),

  -- What the rules scored this person, and in words why. `reason` is what an
  -- admin reads when a member asks; it is not shown in the app.
  score numeric(6, 3),
  reason text check (char_length(reason) <= 200),

  created_at timestamptz not null default now(),

  constraint candidates_not_self check (member_id <> subject_id),
  constraint candidates_one_per_subject unique (set_id, subject_id),
  constraint candidates_one_per_slot unique (set_id, slot),

  foreign key (set_id, member_id)
    references public.candidate_sets (id, member_id) on delete cascade
);

create index candidates_member_idx on public.candidates (member_id, created_at desc);
create index candidates_subject_idx on public.candidates (subject_id);
create index candidates_set_idx on public.candidates (set_id, slot);


-- -------------------------------------------------------------- decisions ---

-- One row per (actor, subject) pair, ever.
--
-- Changing your mind updates the row rather than inserting a second one, which
-- means the pair's current state is a single row with no ordering question.
-- The cost is that the history of a decision is not kept; if that is ever
-- needed it belongs in the audit log, not here, because this table is read on
-- the hot path of every candidate query.
create table public.decisions (
  id uuid primary key default gen_random_uuid(),

  actor_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.profiles (id) on delete cascade,

  kind decision_kind not null,

  -- Which candidate slot this answered, when it came from one. Nullable
  -- because a decision can also come from a shared profile link, and
  -- `on delete set null` because deleting old candidate sets must not delete
  -- the decisions people made about them.
  candidate_id uuid references public.candidates (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint decisions_not_self check (actor_id <> subject_id),
  constraint decisions_one_per_pair unique (actor_id, subject_id)
);

comment on table public.decisions is
  'A like or a pass. Readable only by its author — see the RLS policy in 0009.';

-- The match trigger asks "did the subject already like the actor", so the
-- lookup is by (subject, actor) as well as by (actor, subject).
create index decisions_reciprocal_idx on public.decisions (subject_id, actor_id) where kind = 'like';
create index decisions_actor_idx on public.decisions (actor_id, created_at desc);
create index decisions_candidate_idx on public.decisions (candidate_id);

create trigger decisions_set_updated_at
  before update on public.decisions
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------- matches ---

create table public.matches (
  id uuid primary key default gen_random_uuid(),

  -- Always stored with member_a < member_b. Without a canonical order, (X, Y)
  -- and (Y, X) are two different rows and the unique constraint below cannot
  -- prevent a duplicate match — which would then show as two conversations
  -- for one pair.
  member_a uuid not null references public.profiles (id) on delete cascade,
  member_b uuid not null references public.profiles (id) on delete cascade,

  status match_status not null default 'active',

  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  close_reason text check (char_length(close_reason) <= 200),

  created_at timestamptz not null default now(),

  constraint matches_ordered check (member_a < member_b),
  constraint matches_one_per_pair unique (member_a, member_b),
  constraint matches_closed_has_stamp check ((status = 'closed') = (closed_at is not null))
);

comment on table public.matches is
  'A mutual like. Created only by the reciprocate_like trigger; members never insert directly.';

create index matches_member_a_idx on public.matches (member_a, created_at desc);
create index matches_member_b_idx on public.matches (member_b, created_at desc);
create index matches_closed_by_idx on public.matches (closed_by);


-- Creates the match when a like is reciprocated.
--
-- In the database rather than the app for one reason: the check and the insert
-- have to be a single atomic step. Two members liking each other within the
-- same second is not a rare case, it is the normal case at any volume, and
-- application-side "read then write" produces either two matches or none.
--
-- SECURITY DEFINER because neither member has, or should have, permission to
-- insert a match — there is no member-facing insert policy on matches at all.
-- The only way a row appears is this function, fired by a like.
create or replace function public.reciprocate_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind <> 'like' then
    return null;
  end if;

  -- Did they already like us?
  if not exists (
    select 1 from public.decisions d
    where d.actor_id = new.subject_id
      and d.subject_id = new.actor_id
      and d.kind = 'like'
  ) then
    return null;
  end if;

  insert into public.matches (member_a, member_b)
  values (
    least(new.actor_id, new.subject_id),
    greatest(new.actor_id, new.subject_id)
  )
  -- Both directions can fire in the same instant. Whichever loses does nothing.
  on conflict (member_a, member_b) do nothing;

  return null;
end;
$$;

create trigger decisions_reciprocate
  after insert or update of kind on public.decisions
  for each row execute function public.reciprocate_like();


-- ---------------------------------------------------- candidate generation --

-- Builds every active member's set for a date.
--
-- Set-based, not a loop over members. A cursor over ten thousand members doing
-- one query each is ten thousand round trips inside the database; this is four
-- statements regardless of how many members there are.
--
-- Idempotent: running it twice for the same date does nothing the second time,
-- because candidate_sets has a unique constraint on (member_id, for_date) and
-- candidates are only inserted for sets that were created by this call. That
-- matters because a scheduler that retries is a scheduler that works.
--
-- Returns the number of candidate rows written, so a scheduled run logs
-- something more useful than "ok".
create or replace function public.generate_candidates(
  p_for_date date default current_date,
  p_per_member int default 5,
  p_repeat_window_days int default 14
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Bump this whenever the scoring below changes. It is written onto every set
  -- so an old set stays explainable after the rules move on.
  rule text := 'v1.0';
  written integer;
begin
  if p_per_member < 1 or p_per_member > 20 then
    raise exception 'p_per_member must be between 1 and 20, got %', p_per_member;
  end if;

  -- 1. A set for every member who should receive one.
  --
  -- Unverified members are excluded because they cannot be seen by anyone yet;
  -- generating for them would produce a set nobody can act on. Paused and
  -- dormant members are excluded because showing someone to a member who will
  -- not open the app wastes the subject's scarce slots.
  insert into public.candidate_sets (member_id, for_date, rule_version)
  select p.id, p_for_date, rule
  from public.profiles p
  where p.verification = 'verified'
    and not p.is_paused
    and p.last_active_at > now() - interval '30 days'
  on conflict (member_id, for_date) do nothing;

  -- 2. Fill the sets this call created — identified by having no candidates
  --    yet, which is what makes a re-run a no-op rather than a duplicate.
  with target_sets as (
    select cs.id as set_id, cs.member_id
    from public.candidate_sets cs
    where cs.for_date = p_for_date
      and not exists (select 1 from public.candidates c where c.set_id = cs.id)
  ),
  scored as (
    select
      ts.set_id,
      ts.member_id,
      subject.id as subject_id,

      -- Explainable on purpose. Three additive terms, each one a sentence
      -- somebody could say out loud, rather than a tuned blend nobody can
      -- account for. It is a starting rule, not a recommender.
      (
        case when subject.city = viewer.city then 3 else 0 end
        + 2 * coalesce(array_length(
            array(select unnest(subject.intents) intersect select unnest(viewer.intents)), 1), 0)
        + case when subject.last_active_at > now() - interval '7 days' then 1 else 0 end
      )::numeric as score,

      trim(concat_ws(', ',
        case when subject.city = viewer.city then 'same city' end,
        case when subject.intents && viewer.intents then 'shared intent' end,
        case when subject.last_active_at > now() - interval '7 days' then 'active this week' end
      )) as reason
    from target_sets ts
    join public.profiles viewer on viewer.id = ts.member_id
    join public.preferences pref on pref.member_id = ts.member_id
    join public.profiles subject on subject.id <> ts.member_id

    where subject.verification = 'verified'
      and not subject.is_paused
      and subject.last_active_at > now() - interval '30 days'
      and subject.age is not null

      -- --- the viewer's stated preferences ---------------------------------
      -- An empty array means "no preference". Written as
      -- `cardinality(...) = 0 or ...` rather than as a NULL check so that the
      -- absence of a preference and an explicitly empty one behave the same.
      and subject.age between pref.age_min and pref.age_max
      and (cardinality(pref.interested_in) = 0
           or subject.gender = any (pref.interested_in))
      and (cardinality(pref.intents) = 0
           or subject.intents && pref.intents)
      and (case
             when cardinality(pref.cities) > 0 then subject.city = any (pref.cities)
             else subject.city = viewer.city
           end)

      -- --- things already settled ------------------------------------------
      and not exists (
        select 1 from public.decisions d
        where d.actor_id = ts.member_id and d.subject_id = subject.id
      )
      and not exists (
        select 1 from public.matches m
        where m.member_a = least(ts.member_id, subject.id)
          and m.member_b = greatest(ts.member_id, subject.id)
      )
      -- Shown recently. Without this the same three people reappear every
      -- morning until one of them is decided on, which reads as a broken app.
      and not exists (
        select 1
        from public.candidates prev
        join public.candidate_sets prev_set on prev_set.id = prev.set_id
        where prev.member_id = ts.member_id
          and prev.subject_id = subject.id
          and prev_set.for_date > p_for_date - p_repeat_window_days
      )
  ),
  ranked as (
    select *,
      row_number() over (
        partition by set_id
        -- subject_id last, so a tie breaks the same way on every run. A
        -- non-deterministic order would mean a retry produces a different set.
        order by score desc, subject_id
      ) as slot
    from scored
  ),
  inserted as (
    insert into public.candidates (set_id, member_id, subject_id, slot, score, reason)
    select set_id, member_id, subject_id, slot, score,
           nullif(reason, '')
    from ranked
    where slot <= p_per_member
    returning 1
  )
  select count(*) into written from inserted;

  return written;
end;
$$;

comment on function public.generate_candidates(date, int, int) is
  'Builds daily candidate sets. Idempotent per date. Run nightly; see supabase/README.md for scheduling.';
