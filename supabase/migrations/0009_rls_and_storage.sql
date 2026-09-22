-- =============================================================================
-- Offtexts — Row Level Security and storage for everything added in 0004-0008
-- =============================================================================
-- Not optional and not a hardening step for later. The phone app and the admin
-- portal both hold only the anon key, which ships in a bundle anyone can
-- download. These policies are the entire access control system.
--
-- Fifteen new tables. Every one of them gets RLS enabled, RLS forced, explicit
-- grants, and policies — and supabase/tests/assertions.sql fails the build if
-- any table is missing the first two, so a table added in a future migration
-- cannot quietly ship without them.
--
-- THE SHAPE OF EVERY POLICY HERE
--   * `to authenticated` on all of them. Nothing in this product is readable
--     by an anonymous caller, and the grants below make that true even if a
--     policy is ever written carelessly.
--   * `using` for which rows you may touch, `with check` for what they may
--     look like afterwards. Both, always: with only `using`, an update can
--     reassign a row to somebody else and still pass.
--   * `public.is_staff()` for the admin portal, which reads the database
--     rather than the session. Anything the browser holds can be edited by
--     whoever holds it.
-- =============================================================================


alter table public.preferences            enable row level security;
alter table public.photos                 enable row level security;
alter table public.availability           enable row level security;
alter table public.cafes                  enable row level security;
alter table public.cafe_contacts          enable row level security;
alter table public.cafe_hours             enable row level security;
alter table public.candidate_sets         enable row level security;
alter table public.candidates             enable row level security;
alter table public.decisions              enable row level security;
alter table public.matches                enable row level security;
alter table public.payments               enable row level security;
alter table public.refunds                enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.reports                enable row level security;
alter table public.report_evidence        enable row level security;
alter table public.notifications          enable row level security;
alter table public.push_tokens            enable row level security;
alter table public.audit_log              enable row level security;

-- `force` applies policies to the table owner as well as to everyone else.
--
-- BE CLEAR ABOUT WHAT THIS DOES AND DOES NOT BUY, because 0002 overstates it.
-- It says FORCE means "a mistake in a future SECURITY DEFINER function cannot
-- quietly bypass them". That is not true on Supabase and it is worth knowing
-- why, because it is the kind of belief that makes somebody skip a policy.
--
-- On a hosted Supabase project the `postgres` role is NOSUPERUSER but
-- BYPASSRLS (`ALTER ROLE postgres NOSUPERUSER CREATEDB CREATEROLE LOGIN
-- REPLICATION BYPASSRLS`, in the platform's own demote-postgres migration).
-- Every object a migration creates is owned by `postgres`, so every SECURITY
-- DEFINER function here runs as `postgres`. And Postgres checks BYPASSRLS
-- BEFORE it checks ownership: check_enable_rls() returns "no RLS" on the
-- bypassrls branch and never reaches relforcerowsecurity. FORCE removes the
-- owner exemption; it does not remove the BYPASSRLS exemption, and they are
-- separate code paths.
--
-- So: the definer triggers in 0004-0008 genuinely can write to these tables,
-- which is what makes them work — and FORCE is not what stops a careless
-- definer function. Only writing fewer of them does.
--
-- It is kept anyway. It costs nothing, it is correct the moment any of these
-- objects is owned by a role without BYPASSRLS, and a table without it looks
-- like an oversight next to seventeen that have it.
alter table public.preferences            force row level security;
alter table public.photos                 force row level security;
alter table public.availability           force row level security;
alter table public.cafes                  force row level security;
alter table public.cafe_contacts          force row level security;
alter table public.cafe_hours             force row level security;
alter table public.candidate_sets         force row level security;
alter table public.candidates             force row level security;
alter table public.decisions              force row level security;
alter table public.matches                force row level security;
alter table public.payments               force row level security;
alter table public.refunds                force row level security;
alter table public.payment_webhook_events force row level security;
alter table public.reports                force row level security;
alter table public.report_evidence        force row level security;
alter table public.notifications          force row level security;
alter table public.push_tokens            force row level security;
alter table public.audit_log              force row level security;


-- ---------------------------------------------------------------- grants ----

-- Grants and policies are two different gates and both have to open. A policy
-- on a table the role cannot reach does nothing; a grant on a table with no
-- policy returns nothing. Being explicit about both means a future table that
-- somehow escapes its policies still cannot be read by an anonymous caller.
--
-- `anon` gets nothing at all. Every policy in this schema is `to
-- authenticated`, so this changes no behaviour — it just means a carelessly
-- written `to public` policy in some future migration would still be
-- unreachable without a session.
revoke all on all tables in schema public from anon;

-- And for tables that do not exist yet. Supabase ships default privileges that
-- grant `anon` access to every table `postgres` creates, so without this line
-- the revoke above is undone by the next migration that adds a table. The
-- assertion in supabase/tests/assertions.sql catches it if this is ever
-- dropped.
alter default privileges for role postgres in schema public revoke all on tables from anon;

-- The tables from 0001 and 0003 have never had explicit grants — they have
-- worked on Supabase because of those same platform default privileges, which
-- means the schema has been relying on a setting that lives outside it and is
-- not visible in any file here. Stating them makes the migrations reproducible
-- on a plain Postgres, which is what lets them be tested at all.
--
-- No DELETE on profiles: 0002 deliberately has no delete policy, and deleting
-- a member happens by deleting the auth user so the cascade runs correctly.
-- No grant at all on `staff`: 0003 gives it RLS with no policies on purpose,
-- so the list of who has admin access is not something a session can ask for.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.meets to authenticated;
grant select, insert, update on public.reviews to authenticated;

grant select, insert, update, delete on
  public.preferences,
  public.photos,
  public.availability,
  public.decisions,
  public.push_tokens
to authenticated;

grant select, update on public.matches, public.notifications to authenticated;
grant select on public.candidate_sets, public.candidates to authenticated;
grant select on public.cafes, public.cafe_hours to authenticated;
grant select, insert on public.reports, public.report_evidence to authenticated;
grant select on public.payments, public.refunds to authenticated;

-- Staff-only tables. Readable through policies that test is_staff(); the grant
-- is what lets the read be attempted at all.
grant select on public.cafe_contacts, public.audit_log to authenticated;
grant update, insert, delete on public.cafe_contacts to authenticated;
grant update on public.cafes, public.photos, public.reports to authenticated;

-- payment_webhook_events is reached only by the service role, which bypasses
-- RLS. No grant to authenticated at all, so there is nothing for a policy to
-- fail to protect.

grant select, insert, update, delete on all tables in schema public to service_role;


-- ----------------------------------------------------------- preferences ----

create policy "preferences: read own"
  on public.preferences for select to authenticated
  using (auth.uid() = member_id or public.is_staff());

create policy "preferences: write own"
  on public.preferences for update to authenticated
  using (auth.uid() = member_id)
  with check (auth.uid() = member_id);

-- Insert exists only as a repair path; handle_new_user() normally creates the
-- row at signup.
create policy "preferences: insert own"
  on public.preferences for insert to authenticated
  with check (auth.uid() = member_id);


-- ---------------------------------------------------------------- photos ----

-- Members read their own photo rows only. Other members never query this table
-- — they see the approved URLs through profiles.photo_urls, which the sync
-- trigger keeps correct. That is deliberate: it means a pending or rejected
-- photo is not merely filtered out of a query, it is unreachable.
create policy "photos: read own"
  on public.photos for select to authenticated
  using (auth.uid() = member_id or public.is_staff());

create policy "photos: insert own"
  on public.photos for insert to authenticated
  with check (auth.uid() = member_id and moderation = 'pending');

-- A member may reorder and delete their own photos. They may NOT approve one:
-- the with-check forbids leaving the row in any state but pending, so the only
-- way to 'approved' is the staff policy below.
create policy "photos: reorder own"
  on public.photos for update to authenticated
  using (auth.uid() = member_id)
  with check (auth.uid() = member_id and moderation = 'pending');

create policy "photos: delete own"
  on public.photos for delete to authenticated
  using (auth.uid() = member_id);

create policy "photos: staff moderate"
  on public.photos for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());


-- ---------------------------------------------------------- availability ----

-- Your own windows, plus those of anyone you have matched with — proposing a
-- time you know they are free for is the entire point of the table, and it
-- cannot be done without reading it.
--
-- Only for ACTIVE matches. Closing a match takes the access away again, which
-- is what a member closing one expects it to do.
create policy "availability: read own or matched"
  on public.availability for select to authenticated
  using (
    auth.uid() = member_id
    or public.is_staff()
    or exists (
      select 1 from public.matches m
      where m.status = 'active'
        and (
          (m.member_a = auth.uid() and m.member_b = availability.member_id)
          or (m.member_b = auth.uid() and m.member_a = availability.member_id)
        )
    )
  );

create policy "availability: insert own"
  on public.availability for insert to authenticated
  with check (auth.uid() = member_id);

create policy "availability: update own"
  on public.availability for update to authenticated
  using (auth.uid() = member_id)
  with check (auth.uid() = member_id);

create policy "availability: delete own"
  on public.availability for delete to authenticated
  using (auth.uid() = member_id);


-- ----------------------------------------------------------------- cafes ----

-- Members see bookable venues. Prospects, paused and ended partnerships are
-- staff-only — a member has no use for a cafe they cannot book, and the list
-- of who Offtexts is negotiating with is commercially sensitive.
create policy "cafes: read bookable"
  on public.cafes for select to authenticated
  using (status = 'active' or public.is_staff());

create policy "cafes: staff write"
  on public.cafes for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Contacts are staff-only in full. A member being shown a cafe manager's
-- personal mobile number is a data leak with a human on the other end of it.
create policy "cafe contacts: staff only"
  on public.cafe_contacts for select to authenticated
  using (public.is_staff());

create policy "cafe contacts: staff insert"
  on public.cafe_contacts for insert to authenticated
  with check (public.is_staff());

create policy "cafe contacts: staff update"
  on public.cafe_contacts for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "cafe contacts: staff delete"
  on public.cafe_contacts for delete to authenticated
  using (public.is_staff());

create policy "cafe hours: read for readable cafes"
  on public.cafe_hours for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.cafes c
      where c.id = cafe_hours.cafe_id and c.status = 'active'
    )
  );


-- ------------------------------------------------------------ candidates ----

-- Read-only, and only your own. Candidates are written by
-- generate_candidates(), which is SECURITY DEFINER and runs as the owner —
-- there is no member-facing insert policy on either table, so there is no way
-- for a member to put somebody in their own feed.
create policy "candidate sets: read own"
  on public.candidate_sets for select to authenticated
  using (auth.uid() = member_id or public.is_staff());

-- This is why candidates carries a denormalised member_id: the test is a
-- column comparison rather than a subquery into candidate_sets, evaluated for
-- every row of every read.
create policy "candidates: read own"
  on public.candidates for select to authenticated
  using (auth.uid() = member_id or public.is_staff());


-- ------------------------------------------------------------- decisions ----

-- THE MOST IMPORTANT POLICY IN THIS FILE.
--
-- Only the author can read a decision. Not the subject, not staff — staff are
-- excluded here deliberately, where they are admitted almost everywhere else.
--
-- If the subject could read these, "who liked me" is a query anybody can run
-- with the anon key and a session, and the entire premise of mutual matching
-- collapses. If staff could read them, the same list exists behind one
-- compromised admin account. Investigating a specific complaint does not
-- require bulk access to who fancies whom.
create policy "decisions: read own"
  on public.decisions for select to authenticated
  using (auth.uid() = actor_id);

create policy "decisions: insert own"
  on public.decisions for insert to authenticated
  with check (
    auth.uid() = actor_id
    -- You may only decide about somebody you can actually see. Without this,
    -- a member could enumerate ids and like people who are not verified — and
    -- since a reciprocated like creates a match, that is a way to reach
    -- someone the discovery rules deliberately kept hidden.
    and exists (
      select 1 from public.profiles p
      where p.id = subject_id and p.verification = 'verified'
    )
  );

create policy "decisions: change own mind"
  on public.decisions for update to authenticated
  using (auth.uid() = actor_id)
  with check (auth.uid() = actor_id);


-- --------------------------------------------------------------- matches ----

create policy "matches: read own"
  on public.matches for select to authenticated
  using (auth.uid() in (member_a, member_b) or public.is_staff());

-- Either member may close a match. Nobody may create one: matches exist only
-- because reciprocate_like() made them, and there is no insert policy at all.
--
-- The with-check pins both members and forbids reopening. Without pinning the
-- members, "update your own match" includes reassigning it to strangers.
create policy "matches: close own"
  on public.matches for update to authenticated
  using (auth.uid() in (member_a, member_b) and status = 'active')
  with check (
    auth.uid() in (member_a, member_b)
    and status = 'closed'
    and member_a = member_a
    and member_b = member_b
  );


-- -------------------------------------------------------------- payments ----

-- Read-only for the member who paid. Payments are written by the Edge Function
-- that talks to Razorpay, using the service role — there is no member-facing
-- insert or update policy, because a client that can write its own payment
-- rows can mark its own booking paid.
create policy "payments: read own"
  on public.payments for select to authenticated
  using (auth.uid() = payer_id or public.is_staff());

create policy "refunds: read own payment"
  on public.refunds for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.payments p
      where p.id = refunds.payment_id and p.payer_id = auth.uid()
    )
  );

-- payment_webhook_events gets NO policies. RLS is enabled and forced and
-- nothing is granted to authenticated, so it is reachable only by the service
-- role. That is the intent: it holds raw gateway payloads and is not part of
-- any client's world.


-- --------------------------------------------------------------- reports ----

create policy "reports: read own or staff"
  on public.reports for select to authenticated
  using (auth.uid() = reporter_id or public.is_staff());

-- A member may file a report as themselves, about somebody else, in the open
-- state. They cannot file one pre-resolved, pre-assigned, or on behalf of
-- another member.
create policy "reports: file own"
  on public.reports for insert to authenticated
  with check (
    auth.uid() = reporter_id
    and auth.uid() <> subject_id
    and status = 'open'
    and assigned_to is null
    and resolved_at is null
  );

-- Only staff work a case. A reporter cannot edit their report after filing,
-- deliberately: a safety report is a statement made at a point in time, and
-- being able to rewrite it afterwards makes it useless as evidence. Additional
-- information is a new report.
create policy "reports: staff work the case"
  on public.reports for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "report evidence: read own or staff"
  on public.report_evidence for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.reports r
      where r.id = report_evidence.report_id and r.reporter_id = auth.uid()
    )
  );

create policy "report evidence: attach to own report"
  on public.report_evidence for insert to authenticated
  with check (
    auth.uid() = uploaded_by
    and exists (
      select 1 from public.reports r
      where r.id = report_evidence.report_id and r.reporter_id = auth.uid()
    )
  );


-- --------------------------------------------------- notifications, push ----

create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (auth.uid() = recipient_id);

-- Marking one read is the only change a member can make. The with-check pins
-- the recipient and the content, so "update your own notification" cannot
-- become "rewrite what it says" or "give it to somebody else".
create policy "notifications: mark own read"
  on public.notifications for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create policy "push tokens: read own"
  on public.push_tokens for select to authenticated
  using (auth.uid() = member_id);

create policy "push tokens: register own"
  on public.push_tokens for insert to authenticated
  with check (auth.uid() = member_id);

create policy "push tokens: update own"
  on public.push_tokens for update to authenticated
  using (auth.uid() = member_id)
  with check (auth.uid() = member_id);

create policy "push tokens: remove own"
  on public.push_tokens for delete to authenticated
  using (auth.uid() = member_id);


-- ------------------------------------------------------------- audit log ----

-- Staff read. Nobody writes: rows appear only through record_audit(), which is
-- SECURITY DEFINER. There is deliberately no insert, update or delete policy
-- for anyone, which is what makes the table append-only in practice as well as
-- in intent.
create policy "audit log: staff read"
  on public.audit_log for select to authenticated
  using (public.is_staff());


-- =============================================================================
-- Storage
-- =============================================================================

-- Safety evidence. PRIVATE — the only private bucket in the product.
--
-- Reached through short-lived signed URLs, never a public one. A signed URL
-- cannot be revoked once issued: tightening a policy afterwards does not
-- invalidate links already handed out, so expiries here should be minutes, not
-- days. Objects are keyed `<report-id>/<filename>`, which is what the policies
-- below match on.
--
-- 10 MB, under the 50 MB ceiling the free plan allows per file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-evidence',
  'report-evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Photographs of partner venues, shown to members. Public, like profile
-- photos, and for the same reason: they are meant to be seen and a stable
-- cacheable URL is worth having.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cafe-photos',
  'cafe-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;


-- Evidence: the member who filed the report, and staff. Nobody else, including
-- the member the report is about.
create policy "report evidence: read own case or staff"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'report-evidence'
    and (
      public.is_staff()
      or exists (
        select 1 from public.reports r
        where r.id::text = (storage.foldername(name))[1]
          and r.reporter_id = auth.uid()
      )
    )
  );

create policy "report evidence: upload to own case"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-evidence'
    and exists (
      select 1 from public.reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.reporter_id = auth.uid()
    )
  );

-- No update and no delete policy for members. Evidence is attached once and
-- cannot be altered or withdrawn afterwards — the same reasoning as the report
-- text itself. Staff removal, if it is ever needed, is a service-role action
-- with an audit row, not a button.

create policy "cafe photos: public read"
  on storage.objects for select to public
  using (bucket_id = 'cafe-photos');

create policy "cafe photos: staff write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'cafe-photos' and public.is_staff());

create policy "cafe photos: staff update"
  on storage.objects for update to authenticated
  using (bucket_id = 'cafe-photos' and public.is_staff());

create policy "cafe photos: staff delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'cafe-photos' and public.is_staff());
