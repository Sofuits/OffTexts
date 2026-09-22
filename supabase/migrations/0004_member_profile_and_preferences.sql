-- =============================================================================
-- Offtexts — member profile, preferences, photos, availability
-- =============================================================================
-- Apply with `supabase db push`. Never paste into the SQL editor: the editor
-- does not record the migration in supabase_migrations.schema_migrations, and
-- the GitHub integration then re-runs it on the next merge to main and fails.
--
-- This is the first of the seven migrations that implement "Design the Database
-- and API Contract". It covers four of the sixteen domains on the card:
-- profiles (extended), preferences, photos, availability.
--
-- EVERYTHING HERE IS ADDITIVE.
-- No column is dropped, no column changes type, and nothing the app currently
-- reads stops existing. profiles.photo_urls keeps working exactly as before —
-- it just stops being the source of truth and becomes a cache the database
-- maintains. That is deliberate: a schema change that requires a simultaneous
-- app release is a schema change that will be deployed at the wrong moment.
-- =============================================================================


-- ------------------------------------------------------------------- fix ----

-- reviews.author_id is a foreign key with no index, which means every delete of
-- a profile sequentially scans reviews to check the constraint. Invisible at
-- ten rows, an incident at a million. Found by supabase/tests/assertions.sql,
-- which is exactly the kind of thing that rule exists to find.
create index if not exists reviews_author_idx on public.reviews (author_id, created_at desc);


-- ----------------------------------------------------------------- enums ----

-- Self-described, not inferred, and deliberately including a decline option.
-- 'prefer_not_to_say' is a real answer and has to be storable, or the schema
-- forces people to lie.
create type gender as enum (
  'woman',
  'man',
  'non_binary',
  'other',
  'prefer_not_to_say'
);

-- Photos are reviewed before other members see them. 'pending' is the default
-- because the safe state on upload is not-yet-visible, not visible-until-
-- someone-complains.
create type photo_moderation as enum ('pending', 'approved', 'rejected');


-- -------------------------------------------------------- profiles, more ----

alter table public.profiles
  add column gender gender,

  -- Age is self-reported and, worse, static: a member who joins at 24 is still
  -- 24 in the database three years later. Date of birth is the fact; age is a
  -- cache of it, maintained by the trigger below and by refresh_ages().
  --
  -- Nullable because existing members were never asked. The 18+ rule is
  -- enforced here as well as on `age`, because this is the column that will
  -- eventually be authoritative.
  add column date_of_birth date
    check (date_of_birth is null or date_of_birth <= current_date - interval '18 years'),

  -- Ranking input for candidate generation: a member who has not opened the app
  -- in two months should not be occupying somebody's five slots for the day.
  add column last_active_at timestamptz not null default now(),

  -- Self-service pause. Distinct from verification: 'rejected' is a decision
  -- about a member, paused is a decision by them, and conflating the two means
  -- un-pausing has to guess which it was.
  add column is_paused boolean not null default false;

comment on column public.profiles.age is
  'Cache of date_of_birth, maintained by the profiles_sync_age trigger and public.refresh_ages(). Still the column the app reads.';
comment on column public.profiles.photo_urls is
  'Cache of public.photos, maintained by the photos_sync_profile_urls trigger. Do not write to it directly.';

-- Discovery skips paused and dormant members, so the index that discovery uses
-- has to know about them.
create index profiles_active_idx
  on public.profiles (verification, city, last_active_at desc)
  where not is_paused;


-- Keeps `age` consistent with `date_of_birth` whenever a row is written.
--
-- Only when date_of_birth is present: a member who has only ever given an age
-- keeps it. This is what makes the column addition safe to deploy before the
-- app knows the column exists.
create or replace function public.sync_age_from_dob()
returns trigger
language plpgsql
as $$
begin
  if new.date_of_birth is not null then
    new.age := extract(year from age(current_date, new.date_of_birth))::int;
  end if;
  return new;
end;
$$;

create trigger profiles_sync_age
  before insert or update of date_of_birth on public.profiles
  for each row execute function public.sync_age_from_dob();


-- Recomputes every cached age. Ages change while nobody is writing the row,
-- so a trigger alone is not enough — this is meant to run nightly alongside
-- candidate generation.
--
-- Returns the number of rows it changed so a scheduled run has something to
-- log other than success.
create or replace function public.refresh_ages()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  with updated as (
    update public.profiles
       set age = extract(year from age(current_date, date_of_birth))::int
     where date_of_birth is not null
       and age is distinct from extract(year from age(current_date, date_of_birth))::int
    returning 1
  )
  select count(*) into changed from updated;

  return changed;
end;
$$;

comment on function public.refresh_ages() is
  'Recomputes profiles.age from date_of_birth. Run nightly; see supabase/README.md.';


-- ----------------------------------------------------------- preferences ----

-- One row per member, so member_id IS the primary key. A surrogate id would
-- allow two preference rows for one member, and then every read needs a rule
-- for which one wins.
create table public.preferences (
  member_id uuid primary key references public.profiles (id) on delete cascade,

  -- --- who they want to be shown -------------------------------------------

  age_min int not null default 18 check (age_min between 18 and 120),
  age_max int not null default 99 check (age_max between 18 and 120),

  -- Empty array means "no preference", not "nobody". Every query that reads
  -- these treats empty as unfiltered; a NULL would need the same rule plus a
  -- null check at every call site.
  interested_in gender[] not null default '{}',
  intents meet_intent[] not null default '{}',
  cities text[] not null default '{}'
    check (array_length(cities, 1) is null or array_length(cities, 1) <= 5),

  max_distance_km int check (max_distance_km between 1 and 200),

  -- --- how they want to be told --------------------------------------------

  push_enabled boolean not null default true,
  email_enabled boolean not null default true,

  -- Both or neither. A start with no end is not a quiet period, it is a bug
  -- that silences someone forever.
  quiet_hours_start time,
  quiet_hours_end time,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint preferences_age_range_ordered check (age_min <= age_max),
  constraint preferences_quiet_hours_paired check (
    (quiet_hours_start is null) = (quiet_hours_end is null)
  )
);

comment on table public.preferences is
  'Discovery and notification preferences. Exactly one row per member, created by handle_new_user().';

create trigger preferences_set_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------- photos ----

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,

  -- The object key inside the profile-photos bucket, as
  -- `<member-id>/<timestamp>.<ext>`. Kept separately from the URL because
  -- deleting the object needs the key, and parsing it back out of a URL is the
  -- kind of code that breaks when the URL format changes.
  storage_path text not null unique
    check (char_length(storage_path) between 3 and 500),

  -- The public URL, as returned by getPublicUrl() at upload time. Stored rather
  -- than derived because the database does not know the project URL and should
  -- not have to. If the bucket ever becomes private, this column becomes a
  -- signed URL with an expiry and the repository starts refreshing it — a
  -- change in one file, because callers only ever receive a string.
  url text not null check (url ~ '^https?://'),

  -- 1-6, matching the array limit already on profiles.photo_urls.
  --
  -- Not called `position`: that is a SQL function name and needs quoting in
  -- places you will forget to quote it.
  sort_order int not null check (sort_order between 1 and 6),

  moderation photo_moderation not null default 'pending',
  moderated_by uuid references public.staff (id) on delete set null,
  moderated_at timestamptz,
  rejection_reason text check (char_length(rejection_reason) <= 200),

  width int check (width > 0),
  height int check (height > 0),
  -- Mirrors the 5 MB bucket limit set in 0001. Two places, deliberately: the
  -- bucket limit stops the upload, this stops a row claiming otherwise.
  bytes int check (bytes > 0 and bytes <= 5242880),

  created_at timestamptz not null default now(),

  -- DEFERRABLE matters. Reordering photos swaps two sort_order values, and a
  -- swap passes through a state where both rows hold the same number. With an
  -- immediate constraint that transaction fails and reordering is impossible
  -- without a temporary sentinel value.
  constraint photos_one_per_slot unique (member_id, sort_order) deferrable initially deferred,

  -- A rejection has to say why, and an approval must not pretend to.
  constraint photos_rejection_has_reason check (
    (moderation = 'rejected') = (rejection_reason is not null)
  ),
  constraint photos_moderated_has_stamp check (
    (moderation = 'pending') = (moderated_at is null)
  )
);

comment on table public.photos is
  'Source of truth for member photos. profiles.photo_urls is a cache of the approved ones.';

create index photos_member_idx on public.photos (member_id, sort_order);
create index photos_moderation_queue_idx
  on public.photos (created_at)
  where moderation = 'pending';
create index photos_moderated_by_idx on public.photos (moderated_by);


-- Keeps profiles.photo_urls equal to this member's approved photos, in order.
--
-- The alternative was to have the app write both, which is how two sources of
-- truth start disagreeing: one of the two writes fails, or a second client
-- writes only one of them, and from then on the profile shows a photo the
-- moderation queue has rejected.
--
-- SECURITY DEFINER because a member updating their own photo row must be able
-- to cause a write to their profile row, and the policies are written for the
-- member's own actions, not for the trigger's.
create or replace function public.sync_profile_photo_urls()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.member_id, old.member_id);
begin
  update public.profiles p
     set photo_urls = coalesce((
           select array_agg(ph.url order by ph.sort_order)
           from public.photos ph
           where ph.member_id = target
             and ph.moderation = 'approved'
         ), '{}')
   where p.id = target;

  return null;  -- AFTER trigger; the return value is ignored.
end;
$$;

create trigger photos_sync_profile_urls
  after insert or update or delete on public.photos
  for each row execute function public.sync_profile_photo_urls();


-- ---------------------------------------------------------- availability ----

-- Recurring weekly windows: "most Tuesdays I'm free 6-9pm". That is what a
-- member can actually state about themselves. A concrete date and time is a
-- property of a meeting, not of a person, and lives on meets.
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,

  -- ISO-8601 numbering: 1 = Monday … 7 = Sunday. The same numbering
  -- `extract(isodow from timestamptz)` returns, so matching a meeting time
  -- against a window is a comparison rather than a conversion table.
  weekday int not null check (weekday between 1 and 7),

  starts_at time not null,
  ends_at time not null,

  created_at timestamptz not null default now(),

  constraint availability_window_ordered check (starts_at < ends_at),
  constraint availability_no_exact_duplicate unique (member_id, weekday, starts_at, ends_at)
);

comment on table public.availability is
  'Recurring weekly windows a member is free. Overlapping windows are allowed and mean their union.';

-- Overlapping windows are permitted on purpose. Preventing them needs an
-- exclusion constraint over a custom time range type plus btree_gist, and buys
-- nothing: two overlapping windows mean the union of the two, which is what
-- anyone would expect. The scheduler unions them anyway.

create index availability_member_idx on public.availability (member_id, weekday);


-- --------------------------------------------------------------- signup -----

-- Extended from 0001: a new member now gets a preferences row as well as a
-- profile. Without it every preferences read has to handle "no row yet", which
-- is a null check repeated at every call site to represent a state that should
-- not exist.
--
-- Replaced wholesale rather than patched, because `create or replace function`
-- is the only safe way to change a function body — and the trigger created in
-- 0001 keeps pointing at it without needing to be recreated.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, city)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      'New member'
    ),
    'Pune'
  )
  on conflict (id) do nothing;

  insert into public.preferences (member_id)
  values (new.id)
  on conflict (member_id) do nothing;

  return new;
end;
$$;


-- Backfills preferences for everyone who signed up before this migration.
-- Idempotent, so re-running it is harmless.
insert into public.preferences (member_id)
select id from public.profiles
on conflict (member_id) do nothing;
