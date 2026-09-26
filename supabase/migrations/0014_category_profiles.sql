-- =============================================================================
-- Offtexts — category answers (dating, life partner, co-founder)
-- =============================================================================
-- Apply with `supabase db push`. Never paste into the SQL editor; see 0004.
--
-- The questions that depend on what a member is here for. 0012 built the
-- common profile; this adds the answers for each purpose to the same row, so
-- they are saved, resumed and shared exactly the way the common answers are.
--
-- Numbered 0014 because 0011 is the candidate-count change and 0013 is
-- reserved for the scheduling flow (docs/design/scheduling-flow.md).
--
-- THREE RULES, ALL ENFORCED HERE RATHER THAN IN THE APP
--
--   1. Other members see category answers only for the purpose the member is
--      here for NOW. Somebody who switched from dating to co-founder keeps
--      their dating answers (they may switch back) but no prospective
--      co-founder is shown them.
--
--   2. Religion is private by default. It joins the hideable answers, starts
--      hidden for everybody, and is returned to other members only when the
--      member has chosen to show it — the same mechanism as surname and
--      company in 0012.
--
--   3. Onboarding is not complete without the purpose's required answers.
--
-- EVERYTHING HERE IS ADDITIVE for tables and columns. One function,
-- profile_details_for(), is dropped and recreated because its result columns
-- change, which CREATE OR REPLACE cannot do. It is recreated in the same
-- transaction, so no caller ever finds it missing.
-- =============================================================================


-- ----------------------------------------------------------------- enums ----

-- Dating.
create type relationship_goal as enum (
  'long_term', 'long_term_open_to_short', 'short_term_open_to_long', 'short_term', 'figuring_out'
);

-- Dating and life partner.
create type children_plan as enum (
  'want', 'dont_want', 'have_want_more', 'have_dont_want_more', 'open', 'not_sure'
);

-- Life partner.
create type marriage_timeline as enum (
  'within_1_year', 'one_to_two_years', 'two_to_three_years', 'not_sure'
);
create type marital_status as enum (
  'never_married', 'divorced', 'separated', 'widowed', 'prefer_not_to_say'
);
create type religion as enum (
  'hindu', 'muslim', 'christian', 'sikh', 'jain', 'buddhist', 'parsi', 'jewish',
  'spiritual', 'not_religious', 'other', 'prefer_not_to_say'
);
create type importance_level as enum ('very', 'somewhat', 'not_really');
create type living_arrangement as enum ('with_family', 'on_our_own', 'open', 'not_sure');
create type family_involvement as enum ('my_decision', 'family_involved', 'family_led');
create type relocation_openness as enum ('yes', 'maybe', 'no');

-- Co-founder.
create type cofounder_role as enum ('have_startup', 'want_to_join', 'either');
create type startup_stage as enum ('idea', 'prototype', 'launched', 'revenue');
create type founder_skill as enum (
  'engineering', 'product', 'design', 'sales', 'marketing', 'operations', 'finance', 'domain_expert'
);
create type founder_commitment as enum ('full_time_now', 'full_time_soon', 'part_time');
create type funding_plan as enum ('bootstrapping', 'raised', 'planning_to_raise', 'can_invest', 'not_sure');


-- --------------------------------------------------------------- columns ----

-- All nullable, and arrays default to empty: every answer is optional at the
-- table level. Which ones are required depends on the purpose, and that rule
-- lives in complete_my_onboarding() below.
alter table public.profile_details
  -- dating
  add column relationship_goal relationship_goal,
  add column children_plan children_plan,
  -- Text rather than an enum array so the list can grow without ALTER TYPE;
  -- the CHECK keeps it to the known values. Mirrors PARTNER_VALUES in
  -- src/domain/entities/ProfileDetails.ts.
  add column partner_values text[] not null default '{}'
    check (
      cardinality(partner_values) <= 3
      and partner_values <@ array[
        'kindness', 'humour', 'ambition', 'honesty', 'curiosity',
        'family', 'faith', 'adventure', 'loyalty', 'independence'
      ]
    ),

  -- life partner
  add column marriage_timeline marriage_timeline,
  add column marital_status marital_status,
  add column religion religion,
  add column faith_importance importance_level,
  add column living_arrangement living_arrangement,
  add column family_involvement family_involvement,
  add column open_to_relocate relocation_openness,

  -- co-founder
  add column cofounder_role cofounder_role,
  add column startup_stage startup_stage,
  add column founder_skills founder_skill[] not null default '{}'
    check (cardinality(founder_skills) <= 3),
  add column seeking_skills founder_skill[] not null default '{}'
    check (cardinality(seeking_skills) <= 3),
  add column founder_commitment founder_commitment,
  add column startup_industries text[] not null default '{}'
    check (cardinality(startup_industries) <= 5),
  add column funding_plan funding_plan;


-- ------------------------------------------------------ religion privacy -----

-- Religion becomes hideable. The constraint is replaced rather than altered —
-- Postgres cannot alter a CHECK in place.
alter table public.profile_details
  drop constraint profile_details_hidden_fields_check;

alter table public.profile_details
  add constraint profile_details_hidden_fields_check
  check (hidden_fields <@ array[
    'last_name', 'hometown', 'institution', 'company', 'work_location', 'religion'
  ]);

-- Hidden by default for new rows…
alter table public.profile_details
  alter column hidden_fields set default '{last_name,religion}';

-- …and for every existing row. Nobody has answered the question yet — the
-- column was created above — so nobody can have chosen to show it.
update public.profile_details
   set hidden_fields = array_append(hidden_fields, 'religion')
 where not ('religion' = any (hidden_fields));


-- =============================================================================
-- api_v1 — additions (contract 1.2.0)
-- =============================================================================

-- `select d.*` was expanded into a column list when 0012 created this view,
-- so it has to be restated to include the new columns. The new columns come
-- after the old ones, which is what keeps `create or replace` legal.
create or replace view api_v1.my_profile_details with (security_invoker = true) as
select d.*
from public.profile_details d
where d.member_id = (select auth.uid());


-- Another member's profile details, as they have chosen to show them.
--
-- Same rules as 0012 — who may be read mirrors the profiles select policy,
-- hidden answers come back null, nothing for an anonymous caller — plus the
-- two from the header: religion is a hideable answer, and category answers
-- are returned only for the member's current purpose. The owner always gets
-- everything.
drop function api_v1.profile_details_for(uuid);

create function api_v1.profile_details_for(p_member_id uuid)
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
  prompts jsonb,
  relationship_goal public.relationship_goal,
  children_plan public.children_plan,
  partner_values text[],
  marriage_timeline public.marriage_timeline,
  marital_status public.marital_status,
  religion public.religion,
  faith_importance public.importance_level,
  living_arrangement public.living_arrangement,
  family_involvement public.family_involvement,
  open_to_relocate public.relocation_openness,
  cofounder_role public.cofounder_role,
  startup_stage public.startup_stage,
  founder_skills public.founder_skill[],
  seeking_skills public.founder_skill[],
  founder_commitment public.founder_commitment,
  startup_industries text[],
  funding_plan public.funding_plan
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.member_id,
    case when mine or not ('last_name' = any (d.hidden_fields)) then d.last_name end,
    d.pronouns,
    case when mine or not ('hometown' = any (d.hidden_fields)) then d.hometown end,
    d.languages,
    d.occupation_status,
    d.education_level,
    case when mine or not ('institution' = any (d.hidden_fields)) then d.institution end,
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
    case when mine or not ('company' = any (d.hidden_fields)) then d.company end,
    d.industry,
    d.years_experience,
    case when mine or not ('work_location' = any (d.hidden_fields)) then d.work_location end,
    d.work_mode,
    d.smoking,
    d.drinking,
    d.diet,
    d.exercise,
    d.sleep,
    d.pets,
    d.prompts,

    -- dating
    case when mine or dating then d.relationship_goal end,
    case when mine or dating or life_partner then d.children_plan end,
    case when mine or dating then d.partner_values else '{}' end,

    -- life partner; religion is also a hideable answer
    case when mine or life_partner then d.marriage_timeline end,
    case when mine or life_partner then d.marital_status end,
    case when mine or (life_partner and not ('religion' = any (d.hidden_fields))) then d.religion end,
    case when mine or life_partner then d.faith_importance end,
    case when mine or life_partner then d.living_arrangement end,
    case when mine or life_partner then d.family_involvement end,
    case when mine or life_partner then d.open_to_relocate end,

    -- co-founder
    case when mine or co_founder then d.cofounder_role end,
    case when mine or co_founder then d.startup_stage end,
    case when mine or co_founder then d.founder_skills else '{}' end,
    case when mine or co_founder then d.seeking_skills else '{}' end,
    case when mine or co_founder then d.founder_commitment end,
    case when mine or co_founder then d.startup_industries else '{}' end,
    case when mine or co_founder then d.funding_plan end
  from public.profile_details d
  join public.profiles p on p.id = d.member_id
  cross join lateral (
    select
      d.member_id = auth.uid() as mine,
      'dating' = any (p.intents) as dating,
      'life_partner' = any (p.intents) as life_partner,
      'co_founder' = any (p.intents) as co_founder
  ) as who
  where auth.uid() is not null
    and d.member_id = p_member_id
    and (
      p.id = auth.uid()
      or (p.verification = 'verified' and p.onboarding_completed_at is not null)
    )
$$;

comment on function api_v1.profile_details_for(uuid) is
  'Another member''s profile details: hidden answers removed, category answers for their current purpose only.';


-- Finishes onboarding, once the profile really is finished. As in 0012, plus
-- the answers the member's purpose requires:
--
--   dating        what kind of relationship they want
--   life partner  marriage timeline and marital status
--   co-founder    their role, their commitment, and at least one skill they
--                 are looking for in a co-founder
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


create or replace function api_v1.contract_version()
returns text
language sql
stable
set search_path = ''
as $$ select '1.2.0'::text $$;


grant select on api_v1.my_profile_details to authenticated, service_role;
grant execute on function api_v1.profile_details_for(uuid) to authenticated, service_role;

-- A recreated function starts with PUBLIC execute again. See 0012.
revoke execute on function api_v1.profile_details_for(uuid) from public, anon;
