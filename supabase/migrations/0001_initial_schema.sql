-- =============================================================================
-- Offtexts — initial schema
-- =============================================================================
-- Run this once in the Supabase SQL editor (Database → SQL Editor → New query),
-- then run 0002_row_level_security.sql. The order matters: the policies in 0002
-- reference tables created here.
--
-- Every table below mirrors src/infrastructure/supabase/database.types.ts.
-- After running it, regenerate those types rather than editing them by hand:
--
--   npx supabase gen types typescript --project-id <id> > src/infrastructure/supabase/database.types.ts
--
-- IDENTITY MODEL
-- profiles.id IS auth.users.id. One identity, not two. Every other table
-- references profiles(id), so `auth.uid() = id` is a direct comparison in every
-- policy rather than a subquery — simpler to read and faster to evaluate.
-- =============================================================================

-- gen_random_uuid() lives here. Supabase enables it by default; declared anyway
-- so this file works on a fresh Postgres.
create extension if not exists "pgcrypto";


-- ----------------------------------------------------------------- enums ----
-- Enums rather than text + CHECK: an invalid value becomes impossible at the
-- type level, and the generated TypeScript gets a union instead of `string`.
-- The trade-off is that adding a value needs ALTER TYPE, which is the right
-- amount of friction for something the whole product agrees on.

create type meet_intent as enum ('dating', 'life_partner', 'networking', 'co_founder');
create type verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type meet_status as enum ('pending', 'confirmed', 'completed', 'cancelled');


-- -------------------------------------------------------------- profiles ----

create table public.profiles (
  -- Not a separate key: this IS the auth user id. ON DELETE CASCADE means
  -- deleting the auth user removes the profile, which is what a GDPR-style
  -- deletion request needs.
  id uuid primary key references auth.users (id) on delete cascade,

  name text not null check (char_length(trim(name)) between 2 and 60),

  -- 18 is a product rule, not a formality: this is an 18+ app and the check
  -- belongs where it cannot be bypassed by a client.
  age int check (age between 18 and 120),

  headline text not null default '' check (char_length(headline) <= 140),
  bio text check (char_length(bio) <= 1000),
  city text not null check (char_length(trim(city)) > 0),

  photo_urls text[] not null default '{}' check (array_length(photo_urls, 1) is null or array_length(photo_urls, 1) <= 6),
  interests text[] not null default '{}' check (array_length(interests, 1) is null or array_length(interests, 1) <= 10),
  intents meet_intent[] not null default '{}',

  verification verification_status not null default 'unverified',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per member. id is the auth.users id — see src/infrastructure/supabase/database.types.ts.';

-- Discover filters by city and verification and orders by created_at. Without
-- this index that is a sequential scan on every request.
create index profiles_discover_idx
  on public.profiles (verification, city, created_at desc);

-- `.overlaps('intents', …)` needs a GIN index to be anything but a full scan.
create index profiles_intents_idx on public.profiles using gin (intents);


-- ----------------------------------------------------------------- meets ----

create table public.meets (
  id uuid primary key default gen_random_uuid(),

  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,

  venue_name text not null default 'To be confirmed',
  venue_area text not null default '',

  scheduled_for timestamptz not null,
  status meet_status not null default 'pending',

  created_at timestamptz not null default now(),

  -- Nobody meets themselves. Cheap to enforce, embarrassing to discover in
  -- production.
  constraint meets_distinct_participants check (requester_id <> recipient_id)
);

comment on table public.meets is
  'A booked meeting. Either participant may read it; see the RLS policies.';

-- The app queries `requester_id = me OR recipient_id = me`. Postgres cannot use
-- one index for an OR across two columns, so both are indexed separately.
create index meets_requester_idx on public.meets (requester_id, scheduled_for desc);
create index meets_recipient_idx on public.meets (recipient_id, scheduled_for desc);


-- --------------------------------------------------------------- reviews ----

create table public.reviews (
  id uuid primary key default gen_random_uuid(),

  meet_id uuid not null references public.meets (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,

  -- Mirrors MIN_RATING/MAX_RATING in src/domain/entities/Review.ts. Client
  -- validation is a courtesy; this is the guarantee, because a caller can talk
  -- to PostgREST without going through the app.
  rating int not null check (rating between 1 and 5),

  -- Mirrors SubmitReview.MIN/MAX_COMMENT_LENGTH.
  comment text not null check (char_length(trim(comment)) between 10 and 500),

  created_at timestamptz not null default now(),

  -- One review per person per meet. Without this, a member can rate the same
  -- meet repeatedly and skew the average.
  constraint reviews_one_per_author_per_meet unique (meet_id, author_id)
);

create index reviews_meet_idx on public.reviews (meet_id, created_at desc);


-- --------------------------------------------------------------- triggers ---

-- updated_at has to be maintained by the database. Leaving it to the client
-- means it is right until one client forgets.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- Creates a profile row the moment someone signs up.
--
-- Without it there is a window where a member is authenticated but has no
-- profile, and every screen has to handle that. Google gives us a name and an
-- avatar in raw_user_meta_data, so the profile starts out useful.
--
-- SECURITY DEFINER because this runs as the auth system, before the new user
-- has any permissions of their own. `set search_path = ''` with fully qualified
-- names is required with SECURITY DEFINER — without it a caller can shadow
-- `public` and have this function execute their own code as the owner.
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
  -- A retried sign-up must not fail on the primary key.
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- --------------------------------------------------------------- storage ----

-- Public bucket: profile photos are shown to other members, and a public URL is
-- stable and cacheable. If photos ever need to be private, make this false and
-- switch uploadPhoto() to createSignedUrl — a change in one repository, because
-- callers only receive a string.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,                                   -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
