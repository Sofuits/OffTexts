-- =============================================================================
-- Offtexts — behavioural tests
-- =============================================================================
-- Runs after every migration has applied. Where assertions.sql checks the
-- shape of the schema, this checks that it behaves: triggers fire, constraints
-- reject what they should, and the derived columns stay derived.
--
-- Written as plain SQL with `raise exception` rather than pgTAP, because pgTAP
-- is an extension to install and keep in step and these are twenty tests, not
-- two thousand. If this file ever passes a few hundred, switch.
--
-- Conventions:
--   * ok(...)     — announces a passing check
--   * rejects(...) — asserts a statement violates a constraint
-- Every test runs inside one transaction that is rolled back at the end, so
-- the database is untouched and the file can run twice.
-- =============================================================================

begin;

create or replace function pg_temp.ok(label text)
returns void language plpgsql as $$
begin
  raise notice '  ok  %', label;
end;
$$;

-- Runs a statement and requires it to fail with a constraint violation.
-- `expected` narrows it: rejecting the right thing for the wrong reason is
-- not a passing test, and the classic version of that is a typo'd column name
-- raising undefined_column and the test calling it a success.
create or replace procedure pg_temp.rejects(stmt text, expected text, label text)
language plpgsql as $$
declare
  state text;
begin
  begin
    execute stmt;
  exception when others then
    get stacked diagnostics state = returned_sqlstate;
    if state = expected then
      raise notice '  ok  % (rejected with %)', label, state;
      return;
    end if;
    raise exception 'FAILED: % — expected SQLSTATE %, got % ', label, expected, state;
  end;
  raise exception 'FAILED: % — the statement was accepted and should not have been', label;
end;
$$;

-- Asserts that a statement is allowed to run but changes nothing.
--
-- This is the shape RLS takes on UPDATE and DELETE, and it catches people out:
-- a `using` clause FILTERS rather than rejects, so an update a policy forbids
-- succeeds and reports zero rows. There is no error to catch. Asserting that
-- nothing changed is the only way to test it, and a test that expected an
-- error here would be testing the wrong thing and would pass for the wrong
-- reason if the policy were later removed.
--
-- A `with check` clause is different — it does raise, with 42501 — which is
-- why the INSERT cases below use rejects() and the UPDATE cases use this.
create or replace procedure pg_temp.changes_nothing(stmt text, label text)
language plpgsql as $$
declare
  affected int;
begin
  execute stmt;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAILED: % — the statement changed % row(s)', label, affected;
  end if;
  raise notice '  ok  % (allowed, matched no rows)', label;
end;
$$;

-- SQLSTATEs used below, named so the calls read.
--   23514 check_violation
--   23505 unique_violation
--   23503 foreign_key_violation
--   42501 insufficient_privilege — either no GRANT, or a `with check` failure


-- --------------------------------------------------------------- fixtures ---

\echo 'behaviour: fixtures'

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaa0000-0000-4000-8000-000000000001', 'ava@test',   '{"full_name":"Ava Menon"}'),
  ('aaaa0000-0000-4000-8000-000000000002', 'bhavya@test','{"full_name":"Bhavya Shah"}'),
  ('aaaa0000-0000-4000-8000-000000000003', 'chirag@test','{"full_name":"Chirag Nair"}'),
  ('aaaa0000-0000-4000-8000-000000000004', 'divya@test', '{"full_name":"Divya Rao"}');

do $$
begin
  if (select count(*) from public.profiles) <> 4 then
    raise exception 'FAILED: handle_new_user did not create a profile per auth user';
  end if;
  if (select count(*) from public.preferences) <> 4 then
    raise exception 'FAILED: handle_new_user did not create a preferences row per member';
  end if;
  perform pg_temp.ok('signup creates a profile and a preferences row');
end;
$$;

update public.profiles
   set verification = 'verified',
       date_of_birth = '1998-03-14',
       gender = 'woman',
       intents = '{dating,networking}',
       city = 'Pune';


-- ---------------------------------------------------------------- profile ---

\echo 'behaviour: profile'

do $$
begin
  if (select distinct age from public.profiles) is distinct from
     extract(year from age(current_date, date '1998-03-14'))::int then
    raise exception 'FAILED: age was not derived from date_of_birth';
  end if;
  perform pg_temp.ok('age is derived from date_of_birth');
end;
$$;

call pg_temp.rejects(
  $$update public.profiles set date_of_birth = current_date - interval '17 years'$$,
  '23514', 'a date of birth under 18 is rejected');

do $$
declare changed int;
begin
  update public.profiles set age = 30;
  select public.refresh_ages() into changed;
  if changed <> 4 then
    raise exception 'FAILED: refresh_ages reported % rows, expected 4', changed;
  end if;
  perform pg_temp.ok('refresh_ages repairs drifted ages');
end;
$$;


-- ----------------------------------------------------------------- photos ---

\echo 'behaviour: photos'

insert into public.photos (member_id, storage_path, url, sort_order) values
  ('aaaa0000-0000-4000-8000-000000000001', 'ava/1.jpg', 'https://cdn/ava1.jpg', 1),
  ('aaaa0000-0000-4000-8000-000000000001', 'ava/2.jpg', 'https://cdn/ava2.jpg', 2);

do $$
begin
  if (select photo_urls from public.profiles where id = 'aaaa0000-0000-4000-8000-000000000001') <> '{}' then
    raise exception 'FAILED: unmoderated photos reached the profile';
  end if;
  perform pg_temp.ok('a pending photo is not published');
end;
$$;

update public.photos set moderation = 'approved', moderated_at = now();

do $$
begin
  if (select photo_urls from public.profiles where id = 'aaaa0000-0000-4000-8000-000000000001')
     <> array['https://cdn/ava1.jpg','https://cdn/ava2.jpg'] then
    raise exception 'FAILED: approved photos did not reach the profile in order';
  end if;
  perform pg_temp.ok('approving a photo publishes it, in sort order');
end;
$$;

call pg_temp.rejects(
  $$update public.photos set moderation = 'rejected' where sort_order = 1$$,
  '23514', 'a rejection must give a reason');

do $$
begin
  -- A straight swap, in one statement. Postgres checks a non-deferred unique
  -- constraint row by row as the statement runs, so this fails outright unless
  -- the constraint is DEFERRABLE INITIALLY DEFERRED — which is exactly why it
  -- is declared that way, and exactly what this asserts. No sentinel value, no
  -- three-step dance.
  update public.photos
     set sort_order = case sort_order when 1 then 2 when 2 then 1 end
   where member_id = 'aaaa0000-0000-4000-8000-000000000001'
     and sort_order in (1, 2);
  if (select photo_urls from public.profiles where id = 'aaaa0000-0000-4000-8000-000000000001')
     <> array['https://cdn/ava2.jpg','https://cdn/ava1.jpg'] then
    raise exception 'FAILED: reordering did not reach the profile';
  end if;
  perform pg_temp.ok('photos can be reordered inside one transaction');
end;
$$;

delete from public.photos where sort_order = 1 and member_id = 'aaaa0000-0000-4000-8000-000000000001';

do $$
begin
  if array_length((select photo_urls from public.profiles where id = 'aaaa0000-0000-4000-8000-000000000001'), 1) <> 1 then
    raise exception 'FAILED: deleting a photo did not update the profile';
  end if;
  perform pg_temp.ok('deleting a photo unpublishes it');
end;
$$;


-- ------------------------------------------------------------ preferences ---

\echo 'behaviour: preferences'

call pg_temp.rejects(
  $$update public.preferences set age_min = 40, age_max = 30$$,
  '23514', 'an inverted age range is rejected');

call pg_temp.rejects(
  $$update public.preferences set quiet_hours_start = '22:00'$$,
  '23514', 'quiet hours must have both ends');


-- ------------------------------------------------------------------ cafes ---

\echo 'behaviour: cafes'

call pg_temp.rejects(
  $$insert into public.cafes (name, slug, status, address_line, area, city)
    values ('Nowhere','nowhere','active','1 Some Road','KP','Pune')$$,
  '23514', 'an active cafe must have coordinates and a phone number');

call pg_temp.rejects(
  $$insert into public.cafes (name, slug, address_line, area, city, latitude)
    values ('Half','half','1 Road','KP','Pune', 18.5)$$,
  '23514', 'a latitude with no longitude is rejected');

insert into public.cafes (name, slug, status, address_line, area, city, latitude, longitude, phone)
values ('Mad Over Coffee','mad-over-coffee','active','12 North Main Road','Koregaon Park','Pune',
        18.536200, 73.893900, '+91 20 1234 5678');

insert into public.cafe_contacts (cafe_id, name, role, phone, is_primary)
select id, 'Rhea Kulkarni', 'Manager', '+91 98765 43210', true from public.cafes;

call pg_temp.rejects(
  $$insert into public.cafe_contacts (cafe_id, name, phone, is_primary)
    select id, 'Second Primary', '+91 99999 11111', true from public.cafes$$,
  '23505', 'a cafe may have only one primary contact');

call pg_temp.rejects(
  $$insert into public.cafe_contacts (cafe_id, name) select id, 'Unreachable' from public.cafes$$,
  '23514', 'a contact must have a phone number or an email address');

do $$
begin
  if public.distance_km(18.5286, 73.8742, 18.5362, 73.8939) not between 2 and 3 then
    raise exception 'FAILED: distance_km returned an implausible value: %',
      public.distance_km(18.5286, 73.8742, 18.5362, 73.8939);
  end if;
  if public.distance_km(null, 73.8742, 18.5362, 73.8939) is not null then
    raise exception 'FAILED: distance_km should be null when an argument is null';
  end if;
  perform pg_temp.ok('distance_km is plausible and null-safe');
end;
$$;


-- ------------------------------------------------ candidates and matching ---

\echo 'behaviour: matching'

do $$
declare written int;
begin
  select public.generate_candidates() into written;
  if written <> 12 then
    raise exception 'FAILED: expected 12 candidate rows for 4 mutually-eligible members, got %', written;
  end if;
  perform pg_temp.ok('candidate generation fills every eligible member''s set');

  select public.generate_candidates() into written;
  if written <> 0 then
    raise exception 'FAILED: re-running generation wrote % rows; it must be idempotent', written;
  end if;
  perform pg_temp.ok('re-running generation for the same date is a no-op');
end;
$$;

do $$
begin
  if exists (select 1 from public.candidates where member_id = subject_id) then
    raise exception 'FAILED: a member was offered themselves';
  end if;
  perform pg_temp.ok('nobody is offered themselves');
end;
$$;

do $$
begin
  if exists (
    select 1 from public.candidates c
    join public.profiles v on v.id = c.member_id
    join public.profiles s on s.id = c.subject_id
    where v.city <> s.city
  ) then
    raise exception 'FAILED: a candidate was offered outside the viewer''s city';
  end if;
  perform pg_temp.ok('candidates respect the city preference');
end;
$$;

call pg_temp.rejects(
  $$insert into public.decisions (actor_id, subject_id, kind)
    values ('aaaa0000-0000-4000-8000-000000000001','aaaa0000-0000-4000-8000-000000000001','like')$$,
  '23514', 'a member cannot decide about themselves');

insert into public.decisions (actor_id, subject_id, kind)
values ('aaaa0000-0000-4000-8000-000000000001','aaaa0000-0000-4000-8000-000000000002','like');

do $$
begin
  if exists (select 1 from public.matches) then
    raise exception 'FAILED: a one-sided like created a match';
  end if;
  perform pg_temp.ok('a one-sided like creates no match');
end;
$$;

insert into public.decisions (actor_id, subject_id, kind)
values ('aaaa0000-0000-4000-8000-000000000002','aaaa0000-0000-4000-8000-000000000001','like');

do $$
begin
  if (select count(*) from public.matches) <> 1 then
    raise exception 'FAILED: a reciprocated like did not create exactly one match';
  end if;
  if not (select member_a < member_b from public.matches) then
    raise exception 'FAILED: the match was not stored in canonical order';
  end if;
  perform pg_temp.ok('a reciprocated like creates exactly one, canonically ordered, match');
end;
$$;

insert into public.decisions (actor_id, subject_id, kind)
values ('aaaa0000-0000-4000-8000-000000000003','aaaa0000-0000-4000-8000-000000000001','like'),
       ('aaaa0000-0000-4000-8000-000000000001','aaaa0000-0000-4000-8000-000000000003','pass');

do $$
begin
  if (select count(*) from public.matches) <> 1 then
    raise exception 'FAILED: a pass against a like created a match';
  end if;
  update public.decisions set kind = 'like'
   where actor_id = 'aaaa0000-0000-4000-8000-000000000001'
     and subject_id = 'aaaa0000-0000-4000-8000-000000000003';
  if (select count(*) from public.matches) <> 2 then
    raise exception 'FAILED: changing a pass to a like did not create the match';
  end if;
  perform pg_temp.ok('changing a pass to a like creates the match');
end;
$$;

call pg_temp.rejects(
  $$insert into public.matches (member_a, member_b)
    values ('aaaa0000-0000-4000-8000-000000000004','aaaa0000-0000-4000-8000-000000000003')$$,
  '23514', 'a match stored in the wrong order is rejected');

do $$
declare written int;
begin
  -- Far enough ahead that the repeat window has expired. Anyone already
  -- decided on or matched must still not reappear.
  perform public.generate_candidates(current_date + 30);
  if exists (
    select 1
    from public.candidates c
    join public.candidate_sets cs on cs.id = c.set_id and cs.for_date = current_date + 30
    join public.decisions d on d.actor_id = c.member_id and d.subject_id = c.subject_id
  ) then
    raise exception 'FAILED: somebody already decided on was offered again';
  end if;
  perform pg_temp.ok('decided-on members never reappear, even after the repeat window');
end;
$$;


-- ------------------------------------------------------ meetings, payments --

\echo 'behaviour: meetings and payments'

insert into public.meets (requester_id, recipient_id, scheduled_for, cafe_id, booking_fee_paise)
select 'aaaa0000-0000-4000-8000-000000000001','aaaa0000-0000-4000-8000-000000000002',
       now() + interval '2 days', id, 20000
from public.cafes;

do $$
begin
  if (select venue_name from public.meets) <> 'Mad Over Coffee'
     or (select venue_area from public.meets) <> 'Koregaon Park' then
    raise exception 'FAILED: the venue text was not synced from the cafe';
  end if;
  perform pg_temp.ok('linking a cafe fills in the venue text');
end;
$$;

call pg_temp.rejects(
  $$update public.meets set status = 'completed'$$,
  '23514', 'a completed meeting must carry a completion time');

insert into public.payments (meet_id, payer_id, meet_reference, razorpay_order_id, receipt, amount_paise)
select id, requester_id, 'meet-' || left(id::text, 8), 'order_ABC123', 'rcpt-001', 20000
from public.meets;

call pg_temp.rejects(
  $$update public.payments set status = 'captured', captured = true$$,
  '23514', 'a captured payment must carry a capture time');

call pg_temp.rejects(
  $$update public.payments set status = 'captured', captured = false, captured_at = now()$$,
  '23514', 'the captured flag and the status cannot disagree');

call pg_temp.rejects(
  $$insert into public.payments (meet_reference, razorpay_order_id, receipt, amount_paise)
    values ('x', 'not-a-razorpay-id', 'rcpt-bad', 100)$$,
  '23514', 'an order id that is not a Razorpay order id is rejected');

update public.payments
   set status = 'captured', captured = true, captured_at = now(),
       razorpay_payment_id = 'pay_XYZ789', order_status = 'paid', method = 'upi';

call pg_temp.rejects(
  $$insert into public.payments (meet_id, payer_id, meet_reference, razorpay_order_id, receipt,
                                 amount_paise, status, captured, captured_at)
    select meet_id, payer_id, meet_reference, 'order_DEF456', 'rcpt-002', 20000, 'captured', true, now()
    from public.payments limit 1$$,
  '23505', 'one meeting cannot be successfully paid for twice');

insert into public.refunds (payment_id, razorpay_refund_id, amount_paise, status, processed_at, is_partial)
select id, 'rfnd_AAA111', 5000, 'processed', now(), true from public.payments;

do $$
begin
  if (select amount_refunded_paise from public.payments) <> 5000
     or (select refund_coverage from public.payments) <> 'partial'
     or (select status from public.payments) <> 'captured' then
    raise exception 'FAILED: a partial refund was not reflected on the payment';
  end if;
  perform pg_temp.ok('a partial refund updates the payment total and coverage');
end;
$$;

insert into public.refunds (payment_id, razorpay_refund_id, amount_paise, status, processed_at)
select id, 'rfnd_BBB222', 15000, 'processed', now() from public.payments;

do $$
begin
  if (select amount_refunded_paise from public.payments) <> 20000
     or (select refund_coverage from public.payments) <> 'full'
     or (select status from public.payments) <> 'refunded' then
    raise exception 'FAILED: refunding the full amount did not move the payment to refunded';
  end if;
  perform pg_temp.ok('refunding the full amount moves the payment to refunded');
end;
$$;

do $$
begin
  insert into public.payment_webhook_events (event_id, event_type, payload)
  values ('evt_1','order.paid','{}') on conflict (event_id) do nothing;
  insert into public.payment_webhook_events (event_id, event_type, payload)
  values ('evt_1','order.paid','{}') on conflict (event_id) do nothing;

  if (select count(*) from public.payment_webhook_events) <> 1 then
    raise exception 'FAILED: a duplicate webhook event was stored twice';
  end if;
  perform pg_temp.ok('a redelivered webhook event is stored once');
end;
$$;


-- Availability windows, so the "a match can see them, a stranger cannot" test
-- below has something to look at. Ava is matched with Bhavya; Divya is not.
insert into public.availability (member_id, weekday, starts_at, ends_at) values
  ('aaaa0000-0000-4000-8000-000000000001', 2, '18:00', '21:00'),
  ('aaaa0000-0000-4000-8000-000000000004', 3, '19:00', '22:00');


-- ---------------------------------------------------------------- policies --
--
-- The tests that matter most, because an RLS mistake is silent: the query
-- succeeds, returns rows it should not have, and looks exactly like a query
-- that worked.
--
-- Everything above ran as the superuser, which bypasses RLS entirely. From
-- here the role is switched to `authenticated` and a subject claim is set, so
-- auth.uid() answers and the policies are actually evaluated — the same path
-- PostgREST takes for a request from the phone.

\echo 'behaviour: policies'

-- Ava is a member. Bhavya is a member she has matched with. Divya is a
-- stranger to both. Nobody here is staff.

set role authenticated;
set request.jwt.claim.sub = 'aaaa0000-0000-4000-8000-000000000002';   -- Bhavya

do $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'FAILED: a member cannot see their own profile';
  end if;
  perform pg_temp.ok('a member can read their own profile');

  -- The single most important one in the schema. If this ever returns a row,
  -- "who liked me" is a query anyone can run and mutual matching is over.
  if exists (select 1 from public.decisions where actor_id <> auth.uid()) then
    raise exception 'FAILED: a member can read somebody else''s decisions';
  end if;
  perform pg_temp.ok('a member cannot read anybody else''s likes or passes');

  if exists (select 1 from public.candidates where member_id <> auth.uid()) then
    raise exception 'FAILED: a member can read somebody else''s candidate feed';
  end if;
  if exists (select 1 from public.candidate_sets where member_id <> auth.uid()) then
    raise exception 'FAILED: a member can read somebody else''s candidate sets';
  end if;
  perform pg_temp.ok('a member cannot read anybody else''s candidates');

  if exists (select 1 from public.preferences where member_id <> auth.uid()) then
    raise exception 'FAILED: a member can read somebody else''s preferences';
  end if;
  perform pg_temp.ok('a member cannot read anybody else''s preferences');

  if exists (select 1 from public.photos where member_id <> auth.uid()) then
    raise exception 'FAILED: a member can read somebody else''s photo rows';
  end if;
  perform pg_temp.ok('a member cannot read anybody else''s photo rows');

  if exists (select 1 from public.notifications where recipient_id <> auth.uid()) then
    raise exception 'FAILED: a member can read somebody else''s notifications';
  end if;
  perform pg_temp.ok('a member cannot read anybody else''s notifications');

  if exists (select 1 from public.cafe_contacts) then
    raise exception 'FAILED: a member can read cafe contact details';
  end if;
  perform pg_temp.ok('a member cannot read cafe contacts');

  if exists (select 1 from public.audit_log) then
    raise exception 'FAILED: a member can read the audit log';
  end if;
  perform pg_temp.ok('a member cannot read the audit log');

  if exists (select 1 from public.cafes where status <> 'active') then
    raise exception 'FAILED: a member can see cafes that are not bookable';
  end if;
  perform pg_temp.ok('a member sees only bookable cafes');

  if exists (select 1 from public.matches where auth.uid() not in (member_a, member_b)) then
    raise exception 'FAILED: a member can read a match they are not part of';
  end if;
  perform pg_temp.ok('a member cannot read matches they are not in');

  if exists (select 1 from public.payments where payer_id is distinct from auth.uid()) then
    raise exception 'FAILED: a member can read somebody else''s payments';
  end if;
  perform pg_temp.ok('a member cannot read anybody else''s payments');
end;
$$;

-- Availability: readable for an active match, not for a stranger.
do $$
begin
  if not exists (
    select 1 from public.availability
    where member_id = 'aaaa0000-0000-4000-8000-000000000001'   -- Ava, matched
  ) then
    raise exception 'FAILED: a matched member cannot read their partner''s availability';
  end if;
  if exists (
    select 1 from public.availability
    where member_id = 'aaaa0000-0000-4000-8000-000000000004'   -- Divya, a stranger
  ) then
    raise exception 'FAILED: a member can read a stranger''s availability';
  end if;
  perform pg_temp.ok('availability is visible to a match and not to a stranger');
end;
$$;

-- Writes a member must not be able to make.
call pg_temp.rejects(
  $$insert into public.matches (member_a, member_b)
    values (least('aaaa0000-0000-4000-8000-000000000002'::uuid,'aaaa0000-0000-4000-8000-000000000004'::uuid),
            greatest('aaaa0000-0000-4000-8000-000000000002'::uuid,'aaaa0000-0000-4000-8000-000000000004'::uuid))$$,
  '42501', 'a member cannot create a match out of nothing');

call pg_temp.rejects(
  $$insert into public.photos (member_id, storage_path, url, sort_order, moderation, moderated_at)
    values (auth.uid(), 'bhavya/self.jpg', 'https://cdn/self.jpg', 1, 'approved', now())$$,
  '42501', 'a member cannot approve their own photo');

call pg_temp.rejects(
  $$insert into public.decisions (actor_id, subject_id, kind)
    values ('aaaa0000-0000-4000-8000-000000000004', auth.uid(), 'like')$$,
  '42501', 'a member cannot record a decision on somebody else''s behalf');

call pg_temp.rejects(
  $$insert into public.reports (reporter_id, subject_id, category, details, status, resolved_at, resolution)
    values (auth.uid(), 'aaaa0000-0000-4000-8000-000000000004', 'spam',
            'Filing this already closed.', 'dismissed', now(), 'Nothing to see here.')$$,
  '42501', 'a member cannot file a report that is already resolved');

call pg_temp.rejects(
  $$select 1 from public.payment_webhook_events$$,
  '42501', 'a member cannot reach the raw gateway payloads');

-- A member CAN file a report properly, and then read it back.
do $$
begin
  insert into public.reports (reporter_id, subject_id, category, details)
  values (auth.uid(), 'aaaa0000-0000-4000-8000-000000000004', 'no_show',
          'They did not turn up and did not message.');
  if not exists (select 1 from public.reports where reporter_id = auth.uid()) then
    raise exception 'FAILED: a member cannot read back the report they just filed';
  end if;
  perform pg_temp.ok('a member can file a report and read their own');
end;
$$;

-- And cannot resolve it themselves. The update policy is staff-only, so this
-- runs and matches nothing rather than failing — see changes_nothing() above.
call pg_temp.changes_nothing(
  $$update public.reports set status = 'dismissed', resolved_at = now(),
        resolution = 'Withdrawing this, never mind.'
    where reporter_id = auth.uid()$$,
  'a member cannot close their own safety case');

-- Nor edit what they wrote. A safety report is a statement made at a point in
-- time; being able to rewrite it afterwards would make it useless as evidence.
call pg_temp.changes_nothing(
  $$update public.reports set details = 'Actually it was fine.'
    where reporter_id = auth.uid()$$,
  'a member cannot rewrite a report after filing it');

-- Nor reassign somebody else's notification to themselves.
call pg_temp.changes_nothing(
  $$update public.notifications set read_at = now()
    where recipient_id <> auth.uid()$$,
  'a member cannot touch anybody else''s notifications');

-- Nor un-verify a member to remove them from the discovery feed.
call pg_temp.changes_nothing(
  $$update public.profiles set verification = 'rejected' where id <> auth.uid()$$,
  'a member cannot change anybody else''s verification');

reset role;
reset request.jwt.claim.sub;


-- Staff see what members cannot — and still not the one thing nobody sees.
insert into public.staff (id, role, note)
values ('aaaa0000-0000-4000-8000-000000000003', 'admin', 'Chirag — support');

set role authenticated;
set request.jwt.claim.sub = 'aaaa0000-0000-4000-8000-000000000003';   -- Chirag, now staff

do $$
begin
  if not public.is_staff() then
    raise exception 'FAILED: is_staff() is false for somebody on the staff table';
  end if;
  if not exists (select 1 from public.cafe_contacts) then
    raise exception 'FAILED: staff cannot read cafe contacts';
  end if;
  if not exists (select 1 from public.reports) then
    raise exception 'FAILED: staff cannot read safety cases';
  end if;
  if not exists (select 1 from public.audit_log) then
    raise exception 'FAILED: staff cannot read the audit log';
  end if;
  perform pg_temp.ok('staff can read contacts, cases and the audit log');

  -- Staff are excluded from decisions along with everybody else. Investigating
  -- a complaint does not require bulk access to who fancies whom, and this is
  -- the line that says so.
  if exists (select 1 from public.decisions where actor_id <> auth.uid()) then
    raise exception 'FAILED: staff can read other members'' likes and passes';
  end if;
  perform pg_temp.ok('not even staff can read anybody else''s likes and passes');
end;
$$;

reset role;
reset request.jwt.claim.sub;


-- An unauthenticated caller reaches nothing at all. Not "sees no rows" —
-- cannot reach the table, because anon holds no grant on it.
set role anon;

call pg_temp.rejects($$select 1 from public.profiles$$,
  '42501', 'an anonymous caller cannot reach profiles');
call pg_temp.rejects($$select 1 from public.matches$$,
  '42501', 'an anonymous caller cannot reach matches');
call pg_temp.rejects($$select 1 from public.payments$$,
  '42501', 'an anonymous caller cannot reach payments');

reset role;


-- ------------------------------------------------------------- the contract --
--
-- api_v1 as a client actually meets it: as `authenticated`, through the views
-- and functions, with RLS live underneath. Testing it as the superuser would
-- prove only that the SQL parses.

\echo 'behaviour: api_v1'

set role authenticated;
set request.jwt.claim.sub = 'aaaa0000-0000-4000-8000-000000000002';   -- Bhavya

do $$
begin
  if api_v1.contract_version() <> '1.0.0' then
    raise exception 'FAILED: contract_version() is %, expected 1.0.0', api_v1.contract_version();
  end if;
  perform pg_temp.ok('contract_version() reports 1.0.0');

  if (select count(*) from api_v1.me) <> 1 then
    raise exception 'FAILED: api_v1.me did not return exactly one row';
  end if;
  if (select id from api_v1.me) <> auth.uid() then
    raise exception 'FAILED: api_v1.me returned somebody else';
  end if;
  perform pg_temp.ok('api_v1.me returns exactly the caller');

  if exists (select 1 from api_v1.daily_candidates dc
             where dc.member_id = auth.uid()) then
    raise exception 'FAILED: the caller appears in their own candidate feed';
  end if;
  perform pg_temp.ok('api_v1.daily_candidates never contains the caller');

  -- The staff views are readable by anyone but return nothing without a staff
  -- row, because security_invoker keeps the policies in force. That is the
  -- property the whole contract design rests on.
  if exists (select 1 from api_v1.staff_venues where contacts is not null) then
    raise exception 'FAILED: a member read cafe contacts through a staff view';
  end if;
  perform pg_temp.ok('a staff view leaks nothing to a member');

  if exists (select 1 from api_v1.venues v join public.cafes c on c.id = v.id
             where c.status <> 'active') then
    raise exception 'FAILED: api_v1.venues exposed a cafe that is not bookable';
  end if;
  perform pg_temp.ok('api_v1.venues lists only bookable cafes');
end;
$$;

-- my_matches resolves "the other person" rather than making the client work
-- out which of member_a/member_b it is.
do $$
begin
  if exists (select 1 from api_v1.my_matches where member_id = auth.uid()) then
    raise exception 'FAILED: my_matches returned the caller as the other member';
  end if;
  if (select count(*) from api_v1.my_matches) <> 1 then
    raise exception 'FAILED: expected exactly one match for this member, got %',
      (select count(*) from api_v1.my_matches);
  end if;
  perform pg_temp.ok('api_v1.my_matches resolves the other member');
end;
$$;

-- record_decision returns the match id only once the like is mutual.
do $$
declare result uuid;
begin
  select api_v1.record_decision('aaaa0000-0000-4000-8000-000000000004', 'like') into result;
  if result is not null then
    raise exception 'FAILED: record_decision reported a match for a one-sided like';
  end if;
  perform pg_temp.ok('record_decision returns null for a one-sided like');
end;
$$;

reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = 'aaaa0000-0000-4000-8000-000000000004';   -- Divya, liking back

do $$
declare result uuid;
begin
  select api_v1.record_decision('aaaa0000-0000-4000-8000-000000000002', 'like') into result;
  if result is null then
    raise exception 'FAILED: record_decision did not report the match it just completed';
  end if;
  perform pg_temp.ok('record_decision returns the match id when the like is reciprocated');
end;
$$;

reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = 'aaaa0000-0000-4000-8000-000000000002';   -- Bhavya again

-- Proposing a meeting for a match that is not yours fails, and fails the same
-- way as a match that does not exist — telling the caller which would confirm
-- the match is real.
call pg_temp.rejects(
  $$select api_v1.request_meeting(gen_random_uuid(), null, now() + interval '3 days')$$,
  '42501', 'you cannot propose a meeting for a match you are not in');

call pg_temp.rejects(
  $$select api_v1.request_meeting(
      (select match_id from api_v1.my_matches limit 1),
      (select id from api_v1.venues limit 1),
      now() - interval '1 day')$$,
  '22023', 'you cannot schedule a meeting in the past');

do $$
declare new_meeting uuid;
begin
  select api_v1.request_meeting(
    (select match_id from api_v1.my_matches order by matched_at limit 1),
    (select id from api_v1.venues limit 1),
    now() + interval '3 days'
  ) into new_meeting;

  if not exists (select 1 from api_v1.meetings where meeting_id = new_meeting) then
    raise exception 'FAILED: the meeting just created is not visible through the contract';
  end if;
  if not (select i_requested_it from api_v1.meetings where meeting_id = new_meeting) then
    raise exception 'FAILED: i_requested_it is false for a meeting the caller requested';
  end if;
  if (select with_member_id from api_v1.meetings where meeting_id = new_meeting) = auth.uid() then
    raise exception 'FAILED: meetings resolved the caller as the other participant';
  end if;
  -- The fee is stamped at booking time from current_booking_fee_paise().
  if (select booking_fee_paise from api_v1.meetings where meeting_id = new_meeting)
     is distinct from public.current_booking_fee_paise() then
    raise exception 'FAILED: the booking fee was not stamped onto the meeting';
  end if;
  perform pg_temp.ok('request_meeting creates a meeting the contract can read back');
end;
$$;

call pg_temp.rejects(
  $$select api_v1.set_photo_order(array[gen_random_uuid()])$$,
  '42501', 'you cannot reorder photos that are not yours');

-- 42501, not 23514: two defences forbid this — the RLS `with check` on
-- "reports: file own" and the reports_not_self table constraint — and the
-- policy is evaluated first. Asserting the policy's code rather than the
-- constraint's is deliberate, because the policy is the one that also stops
-- the same insert arriving straight from PostgREST.
call pg_temp.rejects(
  $$select api_v1.file_report(auth.uid(), 'spam', 'Reporting myself.')$$,
  '42501', 'you cannot report yourself');

reset role;
reset request.jwt.claim.sub;

-- An anonymous caller may ask which contract version the server speaks, and
-- nothing else. A released app needs that one answer before it has a session.
set role anon;
do $$
begin
  if api_v1.contract_version() <> '1.0.0' then
    raise exception 'FAILED: an anonymous caller cannot read the contract version';
  end if;
  perform pg_temp.ok('an anonymous caller can read the contract version');
end;
$$;

call pg_temp.rejects($$select 1 from api_v1.me$$,
  '42501', 'an anonymous caller cannot read anything else in api_v1');

reset role;


-- ----------------------------------------------------- deletion behaviour ---

\echo 'behaviour: deletion'

do $$
begin
  delete from auth.users where id = 'aaaa0000-0000-4000-8000-000000000001';

  if exists (select 1 from public.profiles where id = 'aaaa0000-0000-4000-8000-000000000001') then
    raise exception 'FAILED: deleting the auth user left the profile behind';
  end if;

  -- The point of the nullable foreign keys on payments: the money survives.
  if not exists (select 1 from public.payments where razorpay_order_id = 'order_ABC123') then
    raise exception 'FAILED: deleting a member destroyed the financial record';
  end if;
  if (select payer_id from public.payments where razorpay_order_id = 'order_ABC123') is not null then
    raise exception 'FAILED: the payment still points at the deleted member';
  end if;
  if (select meet_reference from public.payments where razorpay_order_id = 'order_ABC123') is null then
    raise exception 'FAILED: the payment lost its human-readable reference';
  end if;

  perform pg_temp.ok('deleting a member removes their data but keeps the payment record, detached');
end;
$$;

rollback;
