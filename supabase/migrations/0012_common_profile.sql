-- =============================================================================
-- Offtexts — the common profile
-- =============================================================================
-- Apply with `supabase db push`. Never paste into the SQL editor; see 0004.
--
-- Everything the onboarding flow asks that every member answers, whatever
-- they are here for: surname, pronouns, hometown, languages, education, what
-- they do, lifestyle, and the short prompts on their profile. The questions
-- that differ by purpose (dating, life partner, co-founder) come later and get
-- their own tables.
--
-- WHY A SEPARATE TABLE AND NOT MORE COLUMNS ON `profiles`
-- Row Level Security decides which ROWS a member can read, not which columns.
-- Any verified member can read every column of every other verified profile,
-- so a column added there is public the moment it exists. The member gets to
-- hide some of these answers — their surname, where they work — and the only
-- way to honour that on the server is to keep them in a table nobody else can
-- read, and hand other members a filtered copy through profile_details_for().
--
-- WHY ONBOARDING NOW SAVES AS IT GOES
-- The old wizard saved once, at the end, to avoid half-built profiles. The
-- flow is now long enough that losing it to a closed app is the bigger harm,
-- so every step saves. A half-built profile is told apart from a real one by
-- profiles.onboarding_completed_at, which only complete_my_onboarding() sets
-- after checking the profile is actually complete.
--
-- EVERYTHING HERE IS ADDITIVE. Existing members are backfilled as complete, so
-- nobody who has already onboarded is sent back through it.
-- =============================================================================


-- ----------------------------------------------------------------- enums ----

-- 'prefer_not_to_say' wherever the question is personal enough that declining
-- is a reasonable answer. Where it is not (study mode, work mode), leaving the
-- question blank is the way to decline.

create type occupation_status as enum (
  'working', 'studying', 'both', 'neither', 'prefer_not_to_say'
);

create type education_level as enum (
  'high_school', 'diploma', 'bachelors', 'masters', 'doctorate', 'other', 'prefer_not_to_say'
);

create type study_mode as enum ('full_time', 'part_time');

create type work_mode as enum ('on_site', 'hybrid', 'remote', 'flexible');

create type smoking_habit as enum (
  'never', 'socially', 'regularly', 'trying_to_quit', 'prefer_not_to_say'
);

create type drinking_habit as enum ('never', 'socially', 'regularly', 'prefer_not_to_say');

create type diet_preference as enum (
  'vegetarian', 'eggetarian', 'non_vegetarian', 'vegan', 'jain', 'other', 'prefer_not_to_say'
);

create type exercise_habit as enum ('never', 'sometimes', 'regularly', 'daily');

create type sleep_schedule as enum ('early_bird', 'night_owl', 'varies');

create type pet_preference as enum ('have_pets', 'want_pets', 'no_pets', 'allergic');


-- ------------------------------------------------------ profiles, more ------

alter table public.profiles
  -- Null until complete_my_onboarding() has checked the profile and stamped
  -- it. This, not "has a date of birth", is now what separates a member from
  -- an account: onboarding saves the date of birth on its third screen.
  add column onboarding_completed_at timestamptz;

comment on column public.profiles.onboarding_completed_at is
  'Set by api_v1.complete_my_onboarding(). Null means onboarding is unfinished.';

-- Everybody who finished the old wizard. That wizard wrote the date of birth
-- and the purpose together, at the end, so having both is exactly "finished".
update public.profiles
   set onboarding_completed_at = coalesce(updated_at, now())
 where date_of_birth is not null
   and cardinality(intents) > 0
   and onboarding_completed_at is null;


-- ------------------------------------------------------- prompt answers -----

-- The prompts a member may answer, stored as a small JSON array on the details
-- row rather than as a table. There are at most three, they are always read
-- and written together, and one column means reordering or swapping a prompt
-- is a single atomic update instead of a delete and three inserts.
--
-- The keys mirror PROFILE_PROMPTS in src/domain/entities/ProfileDetails.ts.
-- Adding a prompt means adding it in both places.
create or replace function public.valid_profile_prompts(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p) is distinct from 'array' then false
    when jsonb_array_length(p) > 3 then false
    else
      not exists (
        select 1
        from jsonb_array_elements(p) as e(item)
        where jsonb_typeof(e.item) is distinct from 'object'
           or jsonb_typeof(e.item -> 'key') is distinct from 'string'
           or jsonb_typeof(e.item -> 'answer') is distinct from 'string'
           or (e.item ->> 'key') not in (
                'perfect_weekend', 'talk_for_hours', 'friends_describe',
                'excited_about', 'you_should_know'
              )
           or char_length(trim(e.item ->> 'answer')) not between 1 and 200
      )
      and (select count(distinct e.item ->> 'key') from jsonb_array_elements(p) as e(item))
          = jsonb_array_length(p)
  end
$$;


-- ------------------------------------------------------ profile_details -----

-- One row per member, created the first time onboarding saves a step. Every
-- answer is nullable: all of it is optional, and "not answered" has to stay
-- different from any answer.
create table public.profile_details (
  member_id uuid primary key references public.profiles (id) on delete cascade,

  -- --- basics --------------------------------------------------------------

  last_name text check (char_length(trim(last_name)) between 1 and 60),
  pronouns text check (char_length(trim(pronouns)) between 1 and 30),
  hometown text check (char_length(trim(hometown)) between 1 and 80),
  languages text[] not null default '{}' check (cardinality(languages) <= 10),

  -- --- what they do --------------------------------------------------------

  occupation_status occupation_status,

  -- Education. For a student these describe what they are studying now, and
  -- graduation_year is when they expect to finish — asking the same three
  -- questions twice, once as "education" and once as "studies", is how a form
  -- gets abandoned.
  education_level education_level,
  institution text check (char_length(trim(institution)) between 1 and 120),
  degree text check (char_length(trim(degree)) between 1 and 120),
  field_of_study text check (char_length(trim(field_of_study)) between 1 and 120),
  graduation_year int check (graduation_year between 1950 and 2100),

  -- Students only.
  study_year int check (study_year between 1 and 10),
  study_mode study_mode,
  previous_education text check (char_length(trim(previous_education)) between 1 and 200),
  internship text check (char_length(trim(internship)) between 1 and 120),
  career_interests text[] not null default '{}' check (cardinality(career_interests) <= 10),
  skills text[] not null default '{}' check (cardinality(skills) <= 15),

  -- Working only.
  occupation text check (char_length(trim(occupation)) between 1 and 80),
  job_title text check (char_length(trim(job_title)) between 1 and 80),
  company text check (char_length(trim(company)) between 1 and 120),
  industry text check (char_length(trim(industry)) between 1 and 80),
  years_experience int check (years_experience between 0 and 60),
  work_location text check (char_length(trim(work_location)) between 1 and 80),
  work_mode work_mode,

  -- --- lifestyle -----------------------------------------------------------

  smoking smoking_habit,
  drinking drinking_habit,
  diet diet_preference,
  exercise exercise_habit,
  sleep sleep_schedule,
  pets pet_preference,

  -- --- about ---------------------------------------------------------------

  prompts jsonb not null default '[]' check (public.valid_profile_prompts(prompts)),

  -- --- privacy and progress ------------------------------------------------

  -- Answers the member has chosen not to show. profile_details_for() blanks
  -- these for everybody but the member. The surname starts hidden: a first
  -- name and a face is how people meet, and a full name is how they are found
  -- elsewhere.
  hidden_fields text[] not null default '{last_name}'
    check (hidden_fields <@ array['last_name', 'hometown', 'institution', 'company', 'work_location']),

  -- The last onboarding step saved, so the flow resumes after it. A step key
  -- from src/presentation/screens/onboarding/steps.tsx, not an index: steps
  -- are added and removed between releases, and an index would silently point
  -- at a different question.
  onboarding_step text check (char_length(onboarding_step) between 1 and 40),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile_details is
  'The common profile. Owner-only; other members read it through api_v1.profile_details_for().';

create trigger profile_details_set_updated_at
  before update on public.profile_details
  for each row execute function public.set_updated_at();

alter table public.profile_details enable row level security;
alter table public.profile_details force row level security;

-- Owner only, for everything. There is deliberately no policy letting another
-- member select from this table, even a verified one: that would return the
-- hidden answers too. They go through profile_details_for() instead.
create policy "profile_details: read own"
  on public.profile_details for select
  to authenticated
  using ((select auth.uid()) = member_id);

create policy "profile_details: insert own"
  on public.profile_details for insert
  to authenticated
  with check ((select auth.uid()) = member_id);

create policy "profile_details: update own"
  on public.profile_details for update
  to authenticated
  using ((select auth.uid()) = member_id)
  with check ((select auth.uid()) = member_id);

-- No delete: the row goes when the profile does.
grant select, insert, update on public.profile_details to authenticated;


-- =============================================================================
-- api_v1 — additions (contract 1.1.0)
-- =============================================================================

-- `me` gains onboarding_completed_at. `create or replace view` may only add
-- columns at the end, which is also what keeps this change additive.
create or replace view api_v1.me with (security_invoker = true) as
select
  p.id,
  p.name,
  p.headline,
  p.bio,
  p.city,
  p.age,
  p.date_of_birth,
  p.gender,
  p.interests,
  p.intents,
  p.photo_urls,
  p.verification,
  p.is_paused,
  p.last_active_at,
  p.created_at,
  p.updated_at,
  p.onboarding_completed_at
from public.profiles p
where p.id = (select auth.uid());


create view api_v1.my_profile_details with (security_invoker = true) as
select d.*
from public.profile_details d
where d.member_id = (select auth.uid());

comment on view api_v1.my_profile_details is
  'The signed-in member''s common profile, including hidden answers and onboarding progress.';


-- Another member's common profile, as they have chosen to show it.
--
-- SECURITY DEFINER because the caller has no policy on profile_details and
-- must not be given one — a policy is all-or-nothing on the row, and the whole
-- point is to hand over part of it. The function is the one place that decides
-- which part, so it is written to fail closed:
--
--   * who may be read mirrors the profiles select policy exactly (yourself, or
--     a verified member) plus "has finished onboarding";
--   * hidden answers come back null, and so does everything that is purely
--     the owner's business (onboarding_step, hidden_fields itself);
--   * nothing is returned at all for an anonymous caller.
create or replace function api_v1.profile_details_for(p_member_id uuid)
returns table (
  member_id uuid,
  last_name text,
  pronouns text,
  hometown text,
  languages text[],
  occupation_status public.occupation_status,
  education_level public.education_level,
  institution text,
  degree text,
  field_of_study text,
  graduation_year int,
  study_year int,
  study_mode public.study_mode,
  previous_education text,
  internship text,
  career_interests text[],
  skills text[],
  occupation text,
  job_title text,
  company text,
  industry text,
  years_experience int,
  work_location text,
  work_mode public.work_mode,
  smoking public.smoking_habit,
  drinking public.drinking_habit,
  diet public.diet_preference,
  exercise public.exercise_habit,
  sleep public.sleep_schedule,
  pets public.pet_preference,
  prompts jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.member_id,
    case when d.member_id = auth.uid() or not ('last_name' = any (d.hidden_fields)) then d.last_name end,
    d.pronouns,
    case when d.member_id = auth.uid() or not ('hometown' = any (d.hidden_fields)) then d.hometown end,
    d.languages,
    d.occupation_status,
    d.education_level,
    case when d.member_id = auth.uid() or not ('institution' = any (d.hidden_fields)) then d.institution end,
    d.degree,
    d.field_of_study,
    d.graduation_year,
    d.study_year,
    d.study_mode,
    d.previous_education,
    d.internship,
    d.career_interests,
    d.skills,
    d.occupation,
    d.job_title,
    case when d.member_id = auth.uid() or not ('company' = any (d.hidden_fields)) then d.company end,
    d.industry,
    d.years_experience,
    case when d.member_id = auth.uid() or not ('work_location' = any (d.hidden_fields)) then d.work_location end,
    d.work_mode,
    d.smoking,
    d.drinking,
    d.diet,
    d.exercise,
    d.sleep,
    d.pets,
    d.prompts
  from public.profile_details d
  join public.profiles p on p.id = d.member_id
  where auth.uid() is not null
    and d.member_id = p_member_id
    and (
      p.id = auth.uid()
      or (p.verification = 'verified' and p.onboarding_completed_at is not null)
    )
$$;

comment on function api_v1.profile_details_for(uuid) is
  'Another member''s common profile with their hidden answers removed.';


-- Finishes onboarding, once the profile really is finished.
--
-- The app checks all of this before calling, so a member never sees these
-- errors in practice. They are here because the app is not the only thing that
-- can call PostgREST, and "onboarding complete" is what moderators and the
-- matching queries will trust.
--
-- SECURITY INVOKER: everything it reads and writes is the caller's own row,
-- which the existing policies already allow.
create or replace function api_v1.complete_my_onboarding()
returns timestamptz
language plpgsql
security invoker
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

  -- Pending photos count: moderation happens after onboarding, and a member
  -- cannot be asked to wait for a moderator before finishing. Rejected ones do
  -- not — they will never be shown.
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

comment on function api_v1.complete_my_onboarding() is
  'Stamps profiles.onboarding_completed_at after checking the profile is complete.';


create or replace function api_v1.contract_version()
returns text
language sql
stable
set search_path = ''
as $$ select '1.1.0'::text $$;


grant select on api_v1.me, api_v1.my_profile_details to authenticated, service_role;
grant execute on function api_v1.profile_details_for(uuid) to authenticated, service_role;
grant execute on function api_v1.complete_my_onboarding() to authenticated, service_role;

-- SECURITY DEFINER functions are executable by PUBLIC by default. This one
-- must not be reachable without a session, even though it returns nothing
-- when auth.uid() is null.
revoke execute on function api_v1.profile_details_for(uuid) from public, anon;
revoke execute on function api_v1.complete_my_onboarding() from public, anon;
