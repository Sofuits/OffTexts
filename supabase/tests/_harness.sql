-- =============================================================================
-- Offtexts — local test harness
-- =============================================================================
-- NOT a migration. This file never runs against Supabase. It stands up the
-- handful of things Supabase provides for free — the auth schema, the storage
-- schema, the three API roles — so that `supabase/migrations/*.sql` can be
-- replayed from empty on a plain Postgres and proven to apply.
--
-- WHY BOTHER
-- `supabase db push` is the only way to find out whether a migration works, and
-- it finds out by running it on the real database. A migration that fails
-- halfway leaves a schema that matches neither the old state nor the new one.
-- Replaying locally first turns that into a test.
--
-- WHAT THIS IS NOT
-- It is not a simulation of Supabase's behaviour. auth.uid() here returns
-- whatever the session variable says, which is enough to prove policies parse
-- and reference real columns — not that they admit and deny the right rows.
-- That is what supabase/tests/policies.sql does, by setting the variable.
--
-- A NOTE ON WHO RUNS THIS
-- Locally these files are applied by a superuser. On Supabase they are applied
-- by `postgres`, which is NOSUPERUSER but BYPASSRLS. Both bypass row-level
-- security completely — Postgres checks BYPASSRLS before it checks ownership,
-- so FORCE ROW LEVEL SECURITY never applies to either — which is why the
-- SECURITY DEFINER triggers behave identically here and there. The policy
-- tests below switch to `authenticated`, which has neither attribute, so the
-- policies are actually evaluated.
--
-- VERSION NOTE
-- Supabase projects created now run Postgres 17; this harness runs on whatever
-- is installed locally, currently 16. Everything the migrations use —
-- security_invoker views (15+), generated columns (12+), enums, GIN indexes —
-- exists in both. If a migration ever needs a 17-only feature, it will pass
-- there and fail here, which is the safe direction for the failure to point.
-- =============================================================================

create extension if not exists "pgcrypto";


-- ----------------------------------------------------------------- roles ----
-- PostgREST connects as `authenticator` and switches to one of these three
-- depending on the JWT. Every `to authenticated` in a policy names the middle
-- one; without the role existing, the policy fails to create.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;


-- ------------------------------------------------------------------ auth ----

create schema if not exists auth;

-- The real table has ~30 columns. These are the ones the migrations reference:
-- the id every profile hangs off, the email the staff insert looks up by, and
-- raw_user_meta_data, which handle_new_user() reads a display name out of.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

-- auth.uid() reads the `sub` claim out of the request JWT. Locally there is no
-- JWT, so it reads a session variable instead and the tests set it. Returning
-- NULL when unset is the important part: it is what makes every policy fail
-- closed for an anonymous caller, exactly as in production.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;


-- --------------------------------------------------------------- storage ----

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name text not null,
  owner_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Splits an object key into path segments. The migrations use
-- `(storage.foldername(name))[1]` to mean "the folder this file is in", which
-- for `<user-id>/<file>` is the owner's id.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/');
$$;

create or replace function storage.filename(name text)
returns text
language sql
immutable
as $$
  select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)];
$$;

alter table storage.objects enable row level security;


-- ---------------------------------------------------------------- grants ----

-- Supabase's own init grants these. Without them every policy that calls
-- auth.uid() — which is every policy in this schema — fails with "permission
-- denied for schema auth" the moment a query runs as anon or authenticated.
--
-- The failure is loud rather than silent, so this is a harness gap rather than
-- a security question. It is only listed here because the tests below cannot
-- evaluate a single policy without it.
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant select on auth.users to service_role;
grant select, insert, update, delete on storage.objects, storage.buckets to authenticated, service_role;
