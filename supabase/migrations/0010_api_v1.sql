-- =============================================================================
-- Offtexts — api_v1, the published contract
-- =============================================================================
-- "Publish a versioned API contract and typed clients", from the card. This is
-- the contract. docs/api/v1.md is its documentation; this file is the thing
-- itself, because a contract that is written down somewhere other than where
-- it is enforced is a description, not a contract.
--
-- WHAT THIS BUYS
-- Right now the clients read `public` directly, so every column name is part
-- of the API and renaming one breaks the phone app in the App Store. A schema
-- of views in front of the tables separates the two: `public` becomes the
-- implementation, free to be refactored, and `api_v1` becomes the promise.
--
-- THE ONE RULE THAT MATTERS HERE
-- Every view is `with (security_invoker = true)`.
--
-- Without it a view runs as its OWNER, which on Supabase is `postgres`, which
-- has BYPASSRLS. The view would then return every row of its base table to
-- anyone holding the anon key — and you cannot put a policy on a view to
-- compensate, because Postgres has no such thing. One omitted setting is a
-- full table dump. supabase/tests/assertions.sql fails the build if any view
-- in this schema is missing it; that check is not optional decoration.
--
-- HOW VERSIONING WORKS
-- The schema name carries the major version. A change that removes or renames
-- anything, or narrows a type, means a new `api_v2` schema created alongside
-- this one, with both exposed while clients migrate — PostgREST selects the
-- schema per request, so a phone on the old release and a phone on the new one
-- can hit the same database at the same time. Additive changes are a minor
-- bump of contract_version() and stay here. See docs/api/v1.md.
--
-- AFTER APPLYING THIS: add `api_v1` to the exposed schemas.
-- Dashboard → Project Settings → API → Exposed schemas → add `api_v1`.
-- PostgREST will not serve it otherwise, and the error it returns does not
-- say so — it says the schema must be one of the exposed ones.
-- =============================================================================

create schema if not exists api_v1;

comment on schema api_v1 is
  'The published API surface, version 1. public/ is the implementation; this is the promise.';


-- ---------------------------------------------------------------- grants ----

-- Supabase's documented grant set for a custom schema. The ALTER DEFAULT
-- PRIVILEGES lines are the ones that are easy to skip and expensive to skip:
-- without them, a view added to this schema in a later migration has no grants
-- and PostgREST answers 404 — not a permission error, a 404, which sends you
-- looking in entirely the wrong place.
grant usage on schema api_v1 to anon, authenticated, service_role;

alter default privileges for role postgres in schema api_v1
  grant select on tables to authenticated, service_role;
alter default privileges for role postgres in schema api_v1
  grant execute on routines to authenticated, service_role;

-- `anon` gets USAGE on the schema and nothing else, so an unauthenticated
-- caller gets a clean "relation does not exist" rather than a row.


-- =============================================================================
-- Views — what a member may read
-- =============================================================================

-- The caller's own profile and settings, in one row.
--
-- `where id = auth.uid()` looks redundant next to RLS, and it is — RLS would
-- return the same row. It is there so the view means one thing when you read
-- it: this is you. A reader should not have to know the policies to know what
-- a view returns.
create view api_v1.me with (security_invoker = true) as
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
  p.updated_at
from public.profiles p
where p.id = (select auth.uid());

comment on view api_v1.me is 'The signed-in member. Exactly one row, or none if not signed in.';


create view api_v1.my_preferences with (security_invoker = true) as
select
  pr.member_id,
  pr.age_min,
  pr.age_max,
  pr.interested_in,
  pr.intents,
  pr.cities,
  pr.max_distance_km,
  pr.push_enabled,
  pr.email_enabled,
  pr.quiet_hours_start,
  pr.quiet_hours_end,
  pr.updated_at
from public.preferences pr
where pr.member_id = (select auth.uid());


-- Photos including the ones still in moderation, because their own member is
-- the one person who should see a pending photo and know it is pending.
create view api_v1.my_photos with (security_invoker = true) as
select
  ph.id,
  ph.url,
  ph.storage_path,
  ph.sort_order,
  ph.moderation,
  ph.rejection_reason,
  ph.width,
  ph.height,
  ph.created_at
from public.photos ph
where ph.member_id = (select auth.uid())
order by ph.sort_order;


create view api_v1.my_availability with (security_invoker = true) as
select a.id, a.weekday, a.starts_at, a.ends_at
from public.availability a
where a.member_id = (select auth.uid())
order by a.weekday, a.starts_at;


-- Today's candidates, with the subject resolved so a client needs one request
-- rather than six.
--
-- `score` and `reason` are NOT here. They are staff-facing — the reasoning
-- behind a recommendation is useful to somebody answering a complaint and
-- corrosive to show the person being recommended to.
create view api_v1.daily_candidates with (security_invoker = true) as
select
  c.id                as candidate_id,
  cs.for_date,
  c.slot,
  s.id                as member_id,
  s.name,
  s.headline,
  s.bio,
  s.city,
  s.age,
  s.gender,
  s.interests,
  s.intents,
  s.photo_urls,
  -- Whether this one has already been answered, so the client can resume
  -- part-way through a set instead of showing the same face twice.
  d.kind              as my_decision
from public.candidates c
join public.candidate_sets cs on cs.id = c.set_id
join public.profiles s on s.id = c.subject_id
left join public.decisions d
       on d.actor_id = c.member_id and d.subject_id = c.subject_id
where c.member_id = (select auth.uid())
order by cs.for_date desc, c.slot;

comment on view api_v1.daily_candidates is
  'The caller''s candidate sets, newest first. Deliberately excludes score and reason.';


-- Matches with "the other person" resolved.
--
-- This is why the table stores member_a/member_b rather than requester/
-- recipient: a match has no direction, and the only question a client ever
-- asks is "who is the other one", which is a CASE rather than two queries.
create view api_v1.my_matches with (security_invoker = true) as
select
  m.id            as match_id,
  m.status,
  m.created_at    as matched_at,
  other.id        as member_id,
  other.name,
  other.headline,
  other.city,
  other.age,
  other.photo_urls,
  -- Has this match already turned into a meeting?
  (select count(*) from public.meets mt where mt.match_id = m.id) as meeting_count
from public.matches m
join public.profiles other
  on other.id = case when m.member_a = (select auth.uid()) then m.member_b else m.member_a end
where (select auth.uid()) in (m.member_a, m.member_b)
order by m.created_at desc;


-- `meets` published under the card's word for it.
--
-- This is the whole point of having a contract schema: the table is called
-- meets because four repositories and a domain entity are built on that name,
-- and the API is called meetings because that is what everyone says. Neither
-- has to move for the other.
create view api_v1.meetings with (security_invoker = true) as
select
  mt.id                    as meeting_id,
  mt.status,
  mt.scheduled_for,
  mt.duration_minutes,
  mt.booking_fee_paise,
  mt.venue_name,
  mt.venue_area,
  mt.cafe_id,
  mt.match_id,
  mt.requester_id = (select auth.uid()) as i_requested_it,
  other.id                 as with_member_id,
  other.name               as with_name,
  other.photo_urls         as with_photo_urls,
  mt.confirmed_at,
  mt.completed_at,
  mt.cancelled_at,
  mt.cancellation_reason,
  case when mt.requester_id = (select auth.uid())
       then mt.requester_checked_in_at else mt.recipient_checked_in_at end as my_check_in,
  mt.created_at
from public.meets mt
join public.profiles other
  on other.id = case when mt.requester_id = (select auth.uid())
                     then mt.recipient_id else mt.requester_id end
where (select auth.uid()) in (mt.requester_id, mt.recipient_id)
order by mt.scheduled_for desc;


-- Bookable venues, with their hours folded in as an array so a client does not
-- need a second request to answer "is it open on Tuesday".
create view api_v1.venues with (security_invoker = true) as
select
  c.id,
  c.name,
  c.slug,
  c.address_line,
  c.area,
  c.city,
  c.latitude,
  c.longitude,
  c.maps_url,
  c.concurrent_meet_capacity,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object(
               'weekday', h.weekday, 'opens_at', h.opens_at, 'closes_at', h.closes_at)
             order by h.weekday, h.opens_at)
      from public.cafe_hours h where h.cafe_id = c.id
    ),
    '[]'::jsonb
  ) as hours
from public.cafes c
where c.status = 'active';

comment on view api_v1.venues is
  'Bookable cafes only. Contact details are deliberately absent — they are staff-facing.';


create view api_v1.my_notifications with (security_invoker = true) as
select n.id, n.kind, n.title, n.body, n.data, n.read_at, n.created_at
from public.notifications n
where n.recipient_id = (select auth.uid())
order by n.created_at desc;


-- Receipts. Razorpay's identifiers are here because a member ringing their
-- bank needs them; the error columns are not, because "error_step: authorize"
-- helps nobody and worries everybody.
create view api_v1.my_payments with (security_invoker = true) as
select
  p.id                    as payment_id,
  p.meet_id               as meeting_id,
  p.receipt,
  p.razorpay_order_id,
  p.razorpay_payment_id,
  p.amount_paise,
  p.amount_refunded_paise,
  p.currency,
  p.status,
  p.refund_coverage,
  p.method,
  p.card_last4,
  p.card_network,
  p.captured_at,
  p.created_at
from public.payments p
where p.payer_id = (select auth.uid());


-- =============================================================================
-- Views — what staff may read
-- =============================================================================
-- Every one of these is still security_invoker, so the staff policies in 0003
-- and 0009 are what admits the rows. A non-staff caller selecting from these
-- gets an empty result, not an error and not a leak.

create view api_v1.staff_members with (security_invoker = true) as
select
  p.id,
  p.name,
  p.city,
  p.age,
  p.gender,
  p.intents,
  p.verification,
  p.is_paused,
  p.last_active_at,
  p.created_at,
  (select count(*) from public.photos ph
    where ph.member_id = p.id and ph.moderation = 'pending') as photos_awaiting_moderation,
  (select count(*) from public.reports r where r.subject_id = p.id) as reports_against
from public.profiles p;


create view api_v1.staff_meetings with (security_invoker = true) as
select
  mt.id as meeting_id,
  mt.status,
  mt.scheduled_for,
  mt.venue_name,
  mt.venue_area,
  mt.booking_fee_paise,
  req.id as requester_id, req.name as requester_name,
  rec.id as recipient_id, rec.name as recipient_name,
  mt.requester_checked_in_at,
  mt.recipient_checked_in_at,
  mt.cancelled_at,
  mt.cancellation_reason,
  pay.status as payment_status,
  pay.amount_paise as paid_paise,
  mt.created_at
from public.meets mt
join public.profiles req on req.id = mt.requester_id
join public.profiles rec on rec.id = mt.recipient_id
left join public.payments pay on pay.meet_id = mt.id
                             and pay.status in ('authorized', 'captured', 'refunded');


create view api_v1.staff_reviews with (security_invoker = true) as
select
  rv.id,
  rv.rating,
  rv.comment,
  rv.created_at,
  a.id as author_id, a.name as author_name,
  mt.id as meeting_id,
  mt.scheduled_for,
  mt.venue_name
from public.reviews rv
join public.profiles a on a.id = rv.author_id
join public.meets mt on mt.id = rv.meet_id;


create view api_v1.staff_reports with (security_invoker = true) as
select
  r.id,
  r.category,
  r.severity,
  r.status,
  r.details,
  r.created_at,
  r.resolved_at,
  r.resolution,
  reporter.id as reporter_id, reporter.name as reporter_name,
  subject.id as subject_id, subject.name as subject_name,
  r.meet_id,
  r.assigned_to,
  (select count(*) from public.report_evidence e where e.report_id = r.id) as evidence_count
from public.reports r
left join public.profiles reporter on reporter.id = r.reporter_id
join public.profiles subject on subject.id = r.subject_id;


create view api_v1.staff_venues with (security_invoker = true) as
select
  c.id,
  c.name,
  c.slug,
  c.status,
  c.address_line,
  c.area,
  c.city,
  c.phone,
  c.concurrent_meet_capacity,
  c.partner_since,
  c.partner_until,
  c.notes,
  (select jsonb_agg(jsonb_build_object(
            'name', ct.name, 'role', ct.role, 'phone', ct.phone,
            'email', ct.email, 'is_primary', ct.is_primary)
          order by ct.is_primary desc, ct.name)
     from public.cafe_contacts ct where ct.cafe_id = c.id) as contacts,
  (select count(*) from public.meets mt where mt.cafe_id = c.id) as meetings_hosted
from public.cafes c;


-- =============================================================================
-- Functions — the verbs
-- =============================================================================
-- All SECURITY INVOKER. That is the important choice: every one of these runs
-- as the caller, so RLS is still what decides whether the write is allowed.
-- A SECURITY DEFINER function here would be a hole with a nice name on it —
-- the policies would stop applying and the function body would become the only
-- thing standing between a caller and the table.
--
-- What these add on top of RLS is the product rules that RLS cannot express:
-- "you may only propose a meeting to somebody you have matched with" is not a
-- row-visibility question, so it lives here and raises a clear error.
--
-- `set search_path = ''` on all of them, so everything resolves the same way
-- regardless of the caller's own search path. That is why every name below is
-- schema-qualified, types included — an unqualified `::decision_kind` fails
-- at runtime, not at creation.

create or replace function api_v1.contract_version()
returns text
language sql
stable
set search_path = ''
as $$ select '1.0.0'::text $$;

comment on function api_v1.contract_version() is
  'Semantic version of this contract. Major = the schema name. See docs/api/v1.md.';


-- Like or pass. Returns the match id when this completed a mutual like, and
-- null otherwise — so a client learns about a new match from the same round
-- trip, rather than polling for one.
create or replace function api_v1.record_decision(
  p_subject_id uuid,
  p_kind public.decision_kind,
  p_candidate_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  match_id uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- Upsert, because the contract's promise is "this is my answer", not "this
  -- is my first answer". Changing a pass to a like is a normal thing to do and
  -- the reciprocate trigger fires on the update just as it does on the insert.
  insert into public.decisions (actor_id, subject_id, kind, candidate_id)
  values (me, p_subject_id, p_kind, p_candidate_id)
  on conflict (actor_id, subject_id)
  do update set kind = excluded.kind, candidate_id = coalesce(excluded.candidate_id, public.decisions.candidate_id);

  select m.id into match_id
  from public.matches m
  where m.member_a = least(me, p_subject_id)
    and m.member_b = greatest(me, p_subject_id)
    and m.status = 'active';

  return match_id;
end;
$$;


-- Propose a meeting to somebody you have matched with.
create or replace function api_v1.request_meeting(
  p_match_id uuid,
  p_cafe_id uuid,
  p_scheduled_for timestamptz,
  p_duration_minutes int default 60
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid;
  fee int;
  new_id uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if p_scheduled_for <= now() then
    raise exception 'A meeting cannot be scheduled in the past' using errcode = '22023';
  end if;

  -- The rule RLS cannot express. The select is itself subject to RLS, so a
  -- match the caller is not part of simply is not found — this raises the same
  -- error for "no such match" and "not your match", which is correct: telling
  -- the caller which one it was would confirm the match exists.
  select case when m.member_a = me then m.member_b else m.member_a end
    into other
  from public.matches m
  where m.id = p_match_id and m.status = 'active' and me in (m.member_a, m.member_b);

  if other is null then
    raise exception 'No active match with that id' using errcode = '42501';
  end if;

  -- Read once here and stored on the meeting, so a fee change later does not
  -- silently reprice a booking somebody already made.
  fee := public.current_booking_fee_paise();

  insert into public.meets
    (requester_id, recipient_id, match_id, cafe_id, scheduled_for, duration_minutes, booking_fee_paise)
  values
    (me, other, p_match_id, p_cafe_id, p_scheduled_for, p_duration_minutes, fee)
  returning id into new_id;

  return new_id;
end;
$$;


-- Confirm or decline a meeting somebody proposed to you.
create or replace function api_v1.respond_to_meeting(
  p_meeting_id uuid,
  p_accept boolean,
  p_reason text default null
)
returns public.meet_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_status public.meet_status;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if p_accept then
    update public.meets
       set status = 'confirmed', confirmed_at = now()
     where id = p_meeting_id and status = 'pending'
    returning status into new_status;
  else
    update public.meets
       set status = 'cancelled', cancelled_at = now(), cancelled_by = me,
           cancellation_reason = p_reason
     where id = p_meeting_id and status in ('pending', 'confirmed')
    returning status into new_status;
  end if;

  -- Zero rows means either no such meeting, or not yours, or already past that
  -- point. RLS filtered it; there is no error to catch, which is why this is
  -- checked explicitly rather than assumed.
  if new_status is null then
    raise exception 'No meeting with that id in a state that can be changed'
      using errcode = '42501';
  end if;

  return new_status;
end;
$$;


-- Arrived. Records the caller's own side only — one person turning up and the
-- other not is exactly the situation this has to be able to represent.
create or replace function api_v1.check_in(p_meeting_id uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  stamp timestamptz;
begin
  update public.meets
     set requester_checked_in_at = case when requester_id = me then now() else requester_checked_in_at end,
         recipient_checked_in_at = case when recipient_id = me then now() else recipient_checked_in_at end
   where id = p_meeting_id
     and status = 'confirmed'
     and me in (requester_id, recipient_id)
  returning case when requester_id = me then requester_checked_in_at else recipient_checked_in_at end
    into stamp;

  if stamp is null then
    raise exception 'No confirmed meeting with that id' using errcode = '42501';
  end if;

  return stamp;
end;
$$;


create or replace function api_v1.mark_notifications_read(p_ids uuid[])
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected int;
begin
  update public.notifications
     set read_at = now()
   where id = any (p_ids) and read_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;


create or replace function api_v1.register_push_token(
  p_token text,
  p_platform public.device_platform
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- The conflict target is the token, not the member: a device that moves to a
  -- different account has to move the token with it, or one person's
  -- notifications go to somebody else's phone.
  insert into public.push_tokens (member_id, token, platform)
  values (me, p_token, p_platform)
  on conflict (token) do update
    set member_id = excluded.member_id,
        platform = excluded.platform,
        last_seen_at = now(),
        disabled_at = null,
        disabled_reason = null;
end;
$$;


create or replace function api_v1.file_report(
  p_subject_id uuid,
  p_category public.report_category,
  p_details text,
  p_meeting_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- Severity is deliberately not a parameter. Triage is staff work, and asking
  -- somebody to rate their own distress on a four-point scale is both unkind
  -- and useless.
  insert into public.reports (reporter_id, subject_id, meet_id, category, details)
  values (me, p_subject_id, p_meeting_id, p_category, p_details)
  returning id into new_id;

  return new_id;
end;
$$;


-- Reorder photos in one statement.
--
-- Takes the full ordered list rather than a pair to swap, because a swap needs
-- two round trips and a client that fails between them leaves the order
-- broken. The photos unique constraint is DEFERRABLE, which is what lets the
-- whole reordering land as one statement.
create or replace function api_v1.set_photo_order(p_ids uuid[])
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  affected int;
begin
  if array_length(p_ids, 1) is null or array_length(p_ids, 1) > 6 then
    raise exception 'Between one and six photo ids are required' using errcode = '22023';
  end if;

  update public.photos ph
     set sort_order = ordered.new_order
    from (select id, ordinality::int as new_order
          from unnest(p_ids) with ordinality as t(id, ordinality)) ordered
   where ph.id = ordered.id and ph.member_id = me;

  get diagnostics affected = row_count;

  if affected <> array_length(p_ids, 1) then
    raise exception 'Some of those photo ids are not yours' using errcode = '42501';
  end if;

  return affected;
end;
$$;


-- ---------------------------------------------------------------- grants ----

-- Explicit, on top of the ALTER DEFAULT PRIVILEGES above. Default privileges
-- only apply to objects created AFTER they are set, and everything in this
-- file was created in the same transaction — so without these lines the views
-- exist and answer 404.
grant select on all tables in schema api_v1 to authenticated, service_role;
grant execute on all routines in schema api_v1 to authenticated, service_role;

-- contract_version() is the one thing an unauthenticated client may call: a
-- released app needs to be able to ask whether the server still speaks its
-- version before it has a session.
grant execute on function api_v1.contract_version() to anon;
