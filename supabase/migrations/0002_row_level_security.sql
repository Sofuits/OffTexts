-- =============================================================================
-- Offtexts — Row Level Security
-- =============================================================================
-- RUN THIS. It is not optional and it is not a hardening step for later.
--
-- The app talks to Postgres directly from the phone, using the anon key. That
-- key ships inside the app bundle and anyone who downloads the app can read it
-- — by design. What stops a stranger reading every row is the policies in this
-- file, and nothing else.
--
-- With RLS off, `select * from profiles` from any HTTP client returns every
-- member's name, city and photos. There is no client-side code that prevents
-- that, because the client is not involved.
--
-- HOW TO VERIFY IT WORKS
-- Supabase dashboard → Authentication → Policies. Every table must show
-- "RLS enabled". Then, in the SQL editor:
--
--   set role anon;
--   select * from public.profiles;   -- must return 0 rows
--   reset role;
--
-- If that returns rows, stop and fix it before shipping anything.
--
-- NOTE ON auth.uid()
-- It returns the authenticated user's id, or NULL for an anonymous request.
-- Every comparison against it therefore fails closed: an unauthenticated caller
-- matches nothing.
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.meets    enable row level security;
alter table public.reviews  enable row level security;

-- Belt and braces. `force` also applies policies to the table owner, so a
-- mistake in a future SECURITY DEFINER function cannot quietly bypass them.
alter table public.profiles force row level security;
alter table public.meets    force row level security;
alter table public.reviews  force row level security;


-- -------------------------------------------------------------- profiles ----

-- Read: your own profile always, plus verified profiles of other members.
--
-- Unverified profiles are deliberately invisible. Someone who has signed up but
-- not been checked is not yet a member other people should see, and this is
-- where that rule is actually enforced — the `.eq('verification','verified')`
-- in the Discover repository is a query optimisation, not a security control.
create policy "profiles: read own or verified"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id
    or verification = 'verified'
  );

-- Insert: only a row that IS you. The signup trigger normally creates it; this
-- covers the case where it needs recreating.
create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Update: only your own row.
--
-- `using` decides which rows you may attempt to update; `with check` decides
-- what the row may look like afterwards. Both are needed — with only `using`,
-- a member could update their own row and set id to somebody else's.
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No delete policy, deliberately. Deleting a profile has to cascade through
-- meets and reviews and needs a considered flow; until that exists, a delete
-- request is handled by removing the auth user, which cascades correctly.


-- ----------------------------------------------------------------- meets ----

create policy "meets: read own"
  on public.meets for select
  to authenticated
  using (auth.uid() in (requester_id, recipient_id));

-- Insert: only as the requester, and only with a verified counterpart.
--
-- The second half is the interesting one: without it, a member could book a
-- meet with somebody who has not passed verification, bypassing the rule that
-- unverified members are not yet part of the community.
create policy "meets: insert as requester"
  on public.meets for insert
  to authenticated
  with check (
    auth.uid() = requester_id
    and exists (
      select 1 from public.profiles p
      where p.id = recipient_id
        and p.verification = 'verified'
    )
  );

-- Update: either participant, for cancelling.
--
-- `with check` repeats the participant test so an update cannot reassign the
-- meet to someone else. Changing scheduled_for or the venue is intentionally
-- allowed here and should be tightened when rescheduling is designed.
create policy "meets: update as participant"
  on public.meets for update
  to authenticated
  using (auth.uid() in (requester_id, recipient_id))
  with check (auth.uid() in (requester_id, recipient_id));


-- --------------------------------------------------------------- reviews ----

-- Read: only the two people who were at the meet.
--
-- Reviews are private to the pair, not public ratings. If that changes — say a
-- member's average becomes visible on their profile — expose it as an aggregate
-- column or a view, not by opening this policy. Opening it would reveal who met
-- whom, which is a far bigger disclosure than a star rating.
create policy "reviews: read for own meets"
  on public.reviews for select
  to authenticated
  using (
    exists (
      select 1 from public.meets m
      where m.id = meet_id
        and auth.uid() in (m.requester_id, m.recipient_id)
    )
  );

-- Insert: you may only review a meet you attended, only as yourself, and only
-- once it has happened.
--
-- The `scheduled_for < now()` test is what stops a member rating a meet before
-- turning up to it.
create policy "reviews: insert for attended meets"
  on public.reviews for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.meets m
      where m.id = meet_id
        and auth.uid() in (m.requester_id, m.recipient_id)
        and m.scheduled_for < now()
        and m.status <> 'cancelled'
    )
  );

-- Update: your own review, for a short window.
--
-- Editing a review indefinitely lets someone rewrite history after a dispute.
-- An hour is enough to fix a typo and short enough not to be a loophole.
create policy "reviews: edit own briefly"
  on public.reviews for update
  to authenticated
  using (auth.uid() = author_id and created_at > now() - interval '1 hour')
  with check (auth.uid() = author_id);


-- --------------------------------------------------------------- storage ----

-- Anyone may view a profile photo: the bucket is public and the URLs are shown
-- to other members.
create policy "profile photos: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-photos');

-- Writes are confined to a folder named after the member's own id.
--
-- uploadPhoto() writes to `<user-id>/<timestamp>.<ext>`, and
-- `storage.foldername(name)[1]` is that first path segment. Without this check
-- any authenticated member could overwrite anyone else's photos.
create policy "profile photos: write own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile photos: update own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile photos: delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
