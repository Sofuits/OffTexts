-- =============================================================================
-- Offtexts — onboarding hardening
-- =============================================================================
-- Apply with `supabase db push`. Never paste into the SQL editor; see 0004.
--
-- Two gaps found in 0012/0014 before either was deployed, fixed here rather
-- than by editing those files.
--
-- 1. A MEMBER COULD MARK THEIR OWN ONBOARDING FINISHED.
--    0012 says onboarding_completed_at is set only by complete_my_onboarding(),
--    which checks the profile first. It was not true: the "profiles: update
--    own" policy and the table-wide UPDATE grant let a member write any column
--    of their own row, so one PATCH could stamp an empty profile as finished
--    and skip every check. A trigger now refuses that column to members, and
--    complete_my_onboarding() becomes SECURITY DEFINER so it is the one thing
--    that can still set it. Its checks are unchanged from 0014.
--
-- 2. LIST ITEMS HAD NO LENGTH LIMIT.
--    The text lists on a profile capped how many items they held, not how
--    long each one was, so one "language" could be a hundred thousand
--    characters and be shown to everybody. Each item is now 1-60 characters
--    after trimming.
--
-- Numbered 0015: it has to deploy with 0012 and 0014. Scheduling, planned in
-- docs/design/scheduling-flow.md, moves to 0016.
-- =============================================================================


-- ------------------------------------------------- completion is guarded ----

-- Refuses a change to onboarding_completed_at made directly by a member.
--
-- `current_user` is the role running the statement: `authenticated` for a
-- member's request through PostgREST, the function owner inside a SECURITY
-- DEFINER function, `postgres` for migrations and the dashboard, and
-- `service_role` for server-side jobs. Only the first is refused, which is
-- exactly "a member, directly".
create or replace function public.guard_onboarding_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.onboarding_completed_at is distinct from old.onboarding_completed_at
     and current_user = 'authenticated' then
    raise exception 'Onboarding is finished through api_v1.complete_my_onboarding()'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_onboarding_completion
  before update of onboarding_completed_at on public.profiles
  for each row execute function public.guard_onboarding_completion();


-- The same checks as 0014, word for word. The one change is SECURITY DEFINER,
-- so the update below runs as the owner and passes the guard above. Every
-- read and write is still keyed on auth.uid(), so running with the owner's
-- rights does not let it see or touch anybody else's row.
create or replace function api_v1.complete_my_onboarding()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  profile public.profiles;
  details public.profile_details;
  photo_count int;
  completed timestamptz;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into profile from public.profiles where id = me;
  select * into details from public.profile_details where member_id = me;

  if profile.date_of_birth is null then
    raise exception 'Add your date of birth' using errcode = '22023';
  end if;
  if profile.gender is null then
    raise exception 'Add your gender' using errcode = '22023';
  end if;
  if cardinality(profile.intents) = 0 then
    raise exception 'Choose what you are here for' using errcode = '22023';
  end if;
  if details.member_id is null or details.occupation_status is null then
    raise exception 'Tell us whether you are working or studying' using errcode = '22023';
  end if;
  if coalesce(char_length(trim(profile.bio)), 0) = 0 then
    raise exception 'Add a short introduction' using errcode = '22023';
  end if;

  if 'dating' = any (profile.intents) and details.relationship_goal is null then
    raise exception 'Tell us what kind of relationship you are looking for' using errcode = '22023';
  end if;
  if 'life_partner' = any (profile.intents)
     and (details.marriage_timeline is null or details.marital_status is null) then
    raise exception 'Add when you would like to marry, and your marital status' using errcode = '22023';
  end if;
  if 'co_founder' = any (profile.intents)
     and (
       details.cofounder_role is null
       or details.founder_commitment is null
       or cardinality(details.seeking_skills) = 0
     ) then
    raise exception 'Tell us about your side of the startup and the co-founder you need'
      using errcode = '22023';
  end if;

  select count(*) into photo_count
  from public.photos
  where member_id = me and moderation <> 'rejected';

  if photo_count < 2 then
    raise exception 'Add at least two photos' using errcode = '22023';
  end if;

  update public.profiles
     set onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = me
  returning onboarding_completed_at into completed;

  return completed;
end;
$$;

-- CREATE OR REPLACE keeps the grants from 0012, including the revoke from
-- anon. Restated so this file says who may call it without looking elsewhere.
revoke execute on function api_v1.complete_my_onboarding() from public, anon;
grant execute on function api_v1.complete_my_onboarding() to authenticated, service_role;


-- ------------------------------------------------------ list item length ----

-- True when every item is present and 1..max_length characters once trimmed.
create or replace function public.valid_list_items(items text[], max_length int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not exists (
    select 1
    from unnest(items) as item
    where item is null or char_length(trim(item)) not between 1 and max_length
  )
$$;

-- Items that break the rule are removed before the constraints go on, and
-- only from rows that have one. The app has never let a blank or over-long
-- item through, so in practice this changes nothing; it is here because a
-- CHECK is re-evaluated on EVERY update of a row, not only updates to the
-- checked column. One bad item left in place would make the whole row
-- un-updatable — for a profile, that includes the trigger that records the
-- member's photos.
create or replace function public.clean_list_items(items text[], max_length int)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(item order by position), '{}')
  from unnest(items) with ordinality as t(item, position)
  where item is not null and char_length(trim(item)) between 1 and max_length
$$;

update public.profile_details
   set languages = public.clean_list_items(languages, 60),
       career_interests = public.clean_list_items(career_interests, 60),
       skills = public.clean_list_items(skills, 60),
       startup_industries = public.clean_list_items(startup_industries, 60)
 where not (
   public.valid_list_items(languages, 60)
   and public.valid_list_items(career_interests, 60)
   and public.valid_list_items(skills, 60)
   and public.valid_list_items(startup_industries, 60)
 );

update public.profiles
   set interests = public.clean_list_items(interests, 60)
 where not public.valid_list_items(interests, 60);

-- Only needed above. Dropped so it is not left behind as a callable RPC.
drop function public.clean_list_items(text[], int);

alter table public.profile_details
  add constraint profile_details_languages_items
    check (public.valid_list_items(languages, 60)),
  add constraint profile_details_career_interests_items
    check (public.valid_list_items(career_interests, 60)),
  add constraint profile_details_skills_items
    check (public.valid_list_items(skills, 60)),
  add constraint profile_details_startup_industries_items
    check (public.valid_list_items(startup_industries, 60));

-- profiles.interests has had the same gap since 0001, and onboarding writes it.
alter table public.profiles
  add constraint profiles_interests_items
    check (public.valid_list_items(interests, 60));
