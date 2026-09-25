-- =============================================================================
-- Offtexts — staff, and what staff may see
-- =============================================================================
-- Apply with `supabase db push`, never by pasting into the SQL Editor. See
-- supabase/README.md for why: the editor does not record the migration, and the
-- GitHub integration then re-runs it on the next merge and fails.
--
-- WHAT THIS IS FOR
-- The admin portal is a browser app holding the anon key, exactly like the
-- phone app. It has no server and no service-role key. So "an admin can see
-- every member" cannot be a decision the admin app makes — it has to be a
-- decision the database makes, which means RLS policies keyed on staff
-- membership.
--
-- That is a feature, not a workaround. The rule lives in one place and applies
-- to anyone holding that session, whether they arrive through the portal, curl,
-- or something nobody has written yet.
-- =============================================================================


-- ------------------------------------------------------------------ staff ----

-- Who works here. Deliberately a separate table rather than a column on
-- profiles:
--
--   * Staff are not members. Putting a `role` on profiles would mean every
--     policy that reads a profile also reads a privilege, and every accidental
--     `select *` in the member app ships the list of who is an admin.
--   * A member may also be staff, or may not exist as a member at all. Two
--     tables express that; one column does not.
--   * Granting and revoking is an insert and a delete on a tiny table that
--     nothing else references.
create table public.staff (
  -- The auth user id. Same identity model as profiles: one person, one id.
  id uuid primary key references auth.users (id) on delete cascade,

  -- Free text on purpose. Roles are a product decision nobody has made yet, and
  -- an enum invented now would be wrong by the time it mattered. Today every
  -- row is an admin; when there is a real distinction, add a CHECK or an enum
  -- in a later migration.
  role text not null default 'admin' check (char_length(trim(role)) between 2 and 40),

  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

comment on table public.staff is
  'Who may use the admin portal. Membership here is what every staff RLS policy below tests.';


-- The test every policy below performs.
--
-- SECURITY DEFINER so it can read public.staff regardless of the caller's own
-- policies, and `set search_path = ''` with fully qualified names because
-- without it a caller can shadow `public` and have this run their code as the
-- owner. STABLE lets Postgres call it once per statement instead of once per
-- row, which matters on a table scan.
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (select 1 from public.staff where id = auth.uid());
$$;

comment on function public.is_staff() is
  'True when the caller is on the staff table. Used by every admin policy.';

-- The function is the only thing that needs to read this table. Nobody queries
-- staff directly, including staff — there is no screen for it, and the list of
-- who has access is not something the anon key should ever return.
alter table public.staff enable row level security;
alter table public.staff force row level security;


-- --------------------------------------------------------- staff: reading ----

-- These are ADDITIONAL policies. Postgres combines policies for the same
-- command with OR, so the existing member policies are untouched: a member
-- still sees their own row and verified profiles, and a staff member sees
-- those plus everything else. Nothing is widened for anyone who is not staff.

create policy "profiles: staff read all"
  on public.profiles for select
  to authenticated
  using (public.is_staff());

create policy "meets: staff read all"
  on public.meets for select
  to authenticated
  using (public.is_staff());

create policy "reviews: staff read all"
  on public.reviews for select
  to authenticated
  using (public.is_staff());


-- --------------------------------------------------------- staff: writing ----

-- "Add to the discovery feed for selected profile IDs", from the ticket.
--
-- Discovery is not a separate flag. `profiles: read own or verified` already
-- means an unverified profile is invisible to other members, so moving someone
-- into the feed IS setting verification to 'verified'. Adding a second column
-- would create two sources of truth for one question and guarantee they
-- disagree.
--
-- USING and WITH CHECK both, as everywhere: USING decides which rows staff may
-- attempt to change, WITH CHECK decides what those rows may look like
-- afterwards. With only USING, a staff member could edit a profile and set its
-- id to somebody else's.
create policy "profiles: staff update verification"
  on public.profiles for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- No staff INSERT or DELETE on profiles. Creating a member is signup's job and
-- deleting one has to cascade through meets and reviews, which needs a
-- considered flow rather than a button on a table row.


-- ---------------------------------------------------------- granting access --
--
-- There is no UI for this and there should not be, because a portal that can
-- grant portal access is one compromised account away from being wide open.
-- Adding a colleague is a deliberate act performed in the SQL editor by someone
-- who already has database access:
--
--   insert into public.staff (id, role, note)
--   select id, 'admin', 'Prashant — engineering'
--   from auth.users where email = 'prashant@example.com';
--
-- And removing one:
--
--   delete from public.staff where id = (
--     select id from auth.users where email = 'someone@example.com'
--   );
