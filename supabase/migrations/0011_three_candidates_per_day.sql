-- =============================================================================
-- Offtexts — three candidates a day, not five
-- =============================================================================
-- The product is three people a day. Every piece of copy a member reads says
-- so — "Three people every morning" on the onboarding finish, "That's today's
-- three" on Today, "Tomorrow morning there will be three" on its empty state,
-- and the browse screens' "outside today's three" — but generate_candidates()
-- defaulted to five, and the nightly job (supabase/README.md) calls it with no
-- argument. Production would have served five while telling people three.
--
-- A parameter default cannot be changed with ALTER FUNCTION, so this restates
-- the function exactly as 0006 defined it, with one difference:
-- p_per_member defaults to 3. CREATE OR REPLACE keeps its owner and grants.
-- Callers that pass p_per_member explicitly are unaffected.
-- =============================================================================

create or replace function public.generate_candidates(
  p_for_date date default current_date,
  p_per_member int default 3,
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
