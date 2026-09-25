-- =============================================================================
-- Offtexts — meetings and payments
-- =============================================================================
-- The meeting half extends the existing `meets` table rather than replacing
-- it. The name stays as it is: four repositories, three mappers and a domain
-- entity are built on it, and renaming a table to match a word on a Trello
-- card is a refactor that buys nothing. The api_v1 contract in 0010 publishes
-- it as `meetings`, which is where the vocabulary actually matters.
--
-- The payments half is modelled directly on Razorpay's documented entities,
-- because a payments table that disagrees with the gateway is a reconciliation
-- problem that grows every day.
--
-- WHAT IS NOT HERE, DELIBERATELY
-- No card number, no expiry, no CVV, no BIN, no cardholder name. RBI's
-- card-on-file rules have prohibited merchants storing the first four since
-- October 2022, and PCI DSS has prohibited the CVV to everyone always. Only
-- `card_last4` and `card_network` are lawful to keep, and they are the only
-- two here. supabase/tests/assertions.sql fails the build if a column that
-- looks like any of the others ever appears.
-- =============================================================================


-- -------------------------------------------------------- meets, extended ---

alter table public.meets
  -- Where the meeting came from. Nullable because a meet can also be arranged
  -- directly, and `on delete set null` because closing a match must not delete
  -- the history of having met.
  add column match_id uuid references public.matches (id) on delete set null,

  -- The partner venue. Nullable: every row that exists today predates the
  -- cafes table and has only the free-text venue_name it was booked with.
  --
  -- `on delete restrict`, not cascade: a cafe with meetings in its history
  -- cannot be deleted. Ending a partnership is `status = 'ended'`, which is
  -- what that enum value is for.
  add column cafe_id uuid references public.cafes (id) on delete restrict,

  add column duration_minutes int not null default 60
    check (duration_minutes between 15 and 480),

  -- What the booking fee was quoted at, in paise, at the moment of booking.
  -- Stored on the meeting and not just on the payment, because the fee will
  -- change and a meeting booked last March was booked at last March's price.
  add column booking_fee_paise int not null default 0
    check (booking_fee_paise >= 0),

  add column confirmed_at timestamptz,
  add column completed_at timestamptz,

  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.profiles (id) on delete set null,
  add column cancellation_reason text check (char_length(cancellation_reason) <= 300),

  -- Check-in is what turns "booked" into "actually happened". Two columns
  -- rather than one, because one person turning up and the other not is the
  -- exact situation reviews and no-show handling care about.
  add column requester_checked_in_at timestamptz,
  add column recipient_checked_in_at timestamptz;

-- The status enum and the timestamps have to agree. Every existing row is
-- 'pending' with all timestamps null, so both constraints already hold and
-- this is safe to add to a live table.
alter table public.meets
  add constraint meets_cancelled_has_stamp
    check ((status = 'cancelled') = (cancelled_at is not null)),
  add constraint meets_completed_has_stamp
    check ((status = 'completed') = (completed_at is not null));

create index meets_match_idx on public.meets (match_id);
create index meets_cafe_idx on public.meets (cafe_id, scheduled_for desc);
create index meets_cancelled_by_idx on public.meets (cancelled_by);
create index meets_upcoming_idx on public.meets (scheduled_for)
  where status in ('pending', 'confirmed');


-- Keeps venue_name and venue_area equal to the linked cafe.
--
-- Same reasoning as profiles.photo_urls: the app already reads those two
-- columns everywhere, so rather than change every screen, the database keeps
-- the old shape correct from the new source of truth. When no cafe is linked
-- the free text is left exactly as it was.
create or replace function public.sync_meet_venue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cafe_id is not null then
    select c.name, c.area into new.venue_name, new.venue_area
    from public.cafes c where c.id = new.cafe_id;
  end if;
  return new;
end;
$$;

create trigger meets_sync_venue
  before insert or update of cafe_id on public.meets
  for each row execute function public.sync_meet_venue();

comment on column public.meets.venue_name is
  'Cache of cafes.name when cafe_id is set, maintained by the meets_sync_venue trigger.';


-- ------------------------------------------------------------ the fee -------

-- What a booking costs today, in paise.
--
-- A function rather than a settings table, because there is exactly one
-- setting and a key-value table for one row is a table nobody indexes, nobody
-- constrains, and everybody eventually puts something else in. Changing the
-- price is a one-line migration, which is the right amount of ceremony for
-- changing a price — it gets reviewed, and it gets a date attached to it in
-- the history.
--
-- The value is copied onto meets.booking_fee_paise at the moment of booking,
-- so changing this never reprices a meeting somebody already agreed to.
--
-- 0 for now. Payments are modelled but not switched on: nothing charges
-- anybody until this is raised and the Razorpay integration is deployed, and
-- a schema that is ready to take money is not the same thing as a product
-- that has started taking it.
create or replace function public.current_booking_fee_paise()
returns int
language sql
immutable
parallel safe
set search_path = ''
as $$ select 0 $$;

comment on function public.current_booking_fee_paise() is
  'The booking fee in paise. Change by migration; meets.booking_fee_paise keeps the value at booking time.';


-- ----------------------------------------------------------------- enums ----

-- Razorpay's own vocabulary, verbatim. Renaming these to something prettier
-- would mean a translation table between our words and the gateway's, and
-- that table would be wrong the first time Razorpay adds a state.
--
-- Order: created → attempted → paid. Note `paid` is terminal and stays `paid`
-- even after a full refund; the refund shows on the payment, not the order.
create type payment_order_status as enum ('created', 'attempted', 'paid');

-- Payment: created → authorized → captured, or → failed. `refunded` is
-- Razorpay's fifth value and only reachable from captured.
create type payment_status as enum (
  'created',
  'authorized',
  'captured',
  'refunded',
  'failed'
);

create type refund_status as enum ('pending', 'processed', 'failed');

-- Only set when a speed was explicitly requested; Razorpay omits these fields
-- otherwise, which is why the columns are nullable.
create type refund_speed as enum ('normal', 'optimum');


-- -------------------------------------------------------------- payments ----

create table public.payments (
  id uuid primary key default gen_random_uuid(),

  -- --- who and what for -----------------------------------------------------
  --
  -- Both `on delete set null`. This is the one place in the schema where a
  -- deletion must NOT cascade: a financial record has to survive the deletion
  -- of the person it relates to, or the books stop balancing and a refund
  -- becomes untraceable. The personal links are severed, the money is kept.
  --
  -- `meet_reference` is what remains readable afterwards.
  meet_id uuid references public.meets (id) on delete set null,
  payer_id uuid references public.profiles (id) on delete set null,
  meet_reference text not null check (char_length(meet_reference) between 3 and 100),

  -- --- Razorpay identifiers -------------------------------------------------

  razorpay_order_id text not null unique check (razorpay_order_id ~ '^order_[A-Za-z0-9]+$'),

  -- Null until a payment is actually attempted. An order with no payment is a
  -- normal, common state: the member opened checkout and closed it.
  razorpay_payment_id text unique check (razorpay_payment_id ~ '^pay_[A-Za-z0-9]+$'),

  -- Our reference, sent to Razorpay as the order receipt. Razorpay caps it at
  -- 40 characters and requires it to be unique, so both are enforced here too
  -- — finding out from a 400 at checkout time is finding out too late.
  receipt text not null unique check (char_length(receipt) between 3 and 40),

  -- --- money ----------------------------------------------------------------
  --
  -- Paise, as integers, because that is the unit Razorpay speaks. A rupee
  -- amount in a float or a numeric is a reconciliation bug waiting for a
  -- number that does not round, and there is no scenario where a fraction of
  -- a paisa is meaningful.
  amount_paise int not null check (amount_paise > 0),
  amount_refunded_paise int not null default 0 check (amount_refunded_paise >= 0),

  currency text not null default 'INR' check (currency = 'INR'),

  -- --- state ----------------------------------------------------------------

  order_status payment_order_status not null default 'created',
  status payment_status not null default 'created',

  -- Razorpay's `refund_status` on the payment entity: null, 'partial' or
  -- 'full'. Named differently from the refund_status ENUM above on purpose —
  -- they describe different things and sharing a name would guarantee one gets
  -- used where the other belongs.
  refund_coverage text check (refund_coverage in ('partial', 'full')),

  captured boolean not null default false,

  -- --- method ---------------------------------------------------------------

  method text check (method in ('upi', 'card', 'netbanking', 'wallet', 'emi', 'paylater')),

  -- The ONLY two card fields that may be stored. See the header.
  card_last4 text check (card_last4 ~ '^[0-9]{4}$'),
  card_network text check (char_length(card_network) <= 40),

  -- --- timeline -------------------------------------------------------------

  -- That the checkout callback's HMAC matched. Recorded rather than the
  -- signature itself: the signature is a one-time proof, and what anyone ever
  -- needs to know later is whether it passed.
  signature_verified_at timestamptz,

  authorized_at timestamptz,
  captured_at timestamptz,

  -- An authorized payment that is never captured is auto-refunded by Razorpay.
  -- Their own documentation gives two different windows on two different pages
  -- — three days and five days — so this is set to the shorter one and any
  -- sweep job must run well inside it. Designing against the longer number
  -- would mean silently losing payments if the shorter one is the real rule.
  capture_deadline_at timestamptz,

  -- --- failure --------------------------------------------------------------

  error_code text,
  error_description text,
  error_source text,
  error_step text,
  error_reason text,

  notes jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A refund cannot exceed what was paid.
  constraint payments_refund_within_amount check (amount_refunded_paise <= amount_paise),

  -- Razorpay's `captured` boolean and its `status` are two representations of
  -- one fact, and they must not disagree.
  constraint payments_captured_matches_status check (
    captured = (status in ('captured', 'refunded'))
  ),
  constraint payments_captured_has_stamp check (
    (status in ('captured', 'refunded')) = (captured_at is not null)
  ),
  constraint payments_failure_has_code check (
    status <> 'failed' or error_code is not null
  )
);

comment on table public.payments is
  'One row per Razorpay order. Survives deletion of the payer and the meeting by design — see the column comments.';

create index payments_meet_idx on public.payments (meet_id);
create index payments_payer_idx on public.payments (payer_id, created_at desc);
create index payments_status_idx on public.payments (status, created_at desc);

-- A meeting can only be successfully paid for once. A partial unique index,
-- because failed and abandoned orders for the same meeting are normal — a
-- member closing checkout and trying again produces exactly that.
create unique index payments_one_success_per_meet
  on public.payments (meet_id)
  where status in ('authorized', 'captured', 'refunded');

-- The sweep that has to capture or abandon authorized payments before Razorpay
-- auto-refunds them. Partial, because it is only ever asked about a handful of
-- rows and scanning the whole table for them would be absurd.
create index payments_awaiting_capture_idx
  on public.payments (capture_deadline_at)
  where status = 'authorized';

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();


-- --------------------------------------------------------------- refunds ----

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,

  razorpay_refund_id text not null unique check (razorpay_refund_id ~ '^rfnd_[A-Za-z0-9]+$'),

  amount_paise int not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),

  status refund_status not null default 'pending',

  -- Present only when a speed was requested. Razorpay omits both fields
  -- otherwise, so null here means "not requested", not "unknown".
  speed_requested refund_speed,
  speed_processed refund_speed,

  is_partial boolean not null default false,

  -- The acquirer's reference number, which is the only thing a member's bank
  -- will accept as proof when they ring to ask where their money is.
  acquirer_reference text check (char_length(acquirer_reference) <= 100),

  reason text check (char_length(reason) <= 300),
  notes jsonb not null default '{}',

  created_at timestamptz not null default now(),
  processed_at timestamptz,

  constraint refunds_processed_has_stamp check (
    (status = 'processed') = (processed_at is not null)
  )
);

comment on table public.refunds is
  'Refunds against a payment. `on delete restrict` — a payment with refunds cannot be deleted.';

create index refunds_payment_idx on public.refunds (payment_id, created_at desc);
create index refunds_status_idx on public.refunds (status) where status = 'pending';


-- Keeps the payment's refunded total equal to the sum of its processed
-- refunds, and sets the coverage flag Razorpay also reports.
--
-- Derived in the database for the same reason as everywhere else in this
-- schema: two writers eventually disagree, and the one that is wrong is
-- always the one somebody is looking at.
create or replace function public.sync_payment_refund_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.payment_id, old.payment_id);
  total int;
  paid int;
begin
  select coalesce(sum(r.amount_paise), 0) into total
  from public.refunds r
  where r.payment_id = target and r.status = 'processed';

  select p.amount_paise into paid from public.payments p where p.id = target;

  update public.payments
     set amount_refunded_paise = total,
         refund_coverage = case
           when total = 0 then null
           when total >= paid then 'full'
           else 'partial'
         end,
         -- Schema-qualified. `set search_path = ''` above is what makes this
         -- function safe from search-path hijacking, and the price of it is
         -- that NOTHING resolves unqualified — types included. An unqualified
         -- `::payment_status` here fails at runtime, inside a trigger, on the
         -- first refund, which is the worst possible place to find out.
         status = case when total >= paid then 'refunded'::public.payment_status else status end
   where id = target;

  return null;
end;
$$;

create trigger refunds_sync_payment_total
  after insert or update or delete on public.refunds
  for each row execute function public.sync_payment_refund_total();


-- ------------------------------------------------- webhook idempotency -----

-- Razorpay delivers at-least-once, retries with backoff for 24 hours, and does
-- not guarantee ordering. Duplicates are documented as expected behaviour, not
-- as an error condition — so the receiver has to be idempotent, and this table
-- is what makes it so.
--
-- The key is `x-razorpay-event-id`, which Razorpay documents as unique per
-- event. Not the payment id: that repeats across the authorized, captured and
-- refunded events for one payment, so using it would drop real events.
--
-- The handler inserts with `on conflict (event_id) do nothing` and returns 200
-- immediately if nothing was inserted. Razorpay's timeout is five seconds and
-- a slow response is retried, which is another way to receive a duplicate.
create table public.payment_webhook_events (
  event_id text primary key check (char_length(event_id) between 3 and 200),
  event_type text not null check (char_length(event_type) between 3 and 100),

  -- The raw body as received, after the HMAC has been verified against it.
  -- Kept for reconciliation and for the arguments that start "your system says
  -- we were never told".
  payload jsonb not null,

  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

comment on table public.payment_webhook_events is
  'Idempotency ledger for gateway webhooks. Service role only: RLS is forced and there are deliberately no policies.';

create index payment_webhook_events_unprocessed_idx
  on public.payment_webhook_events (received_at)
  where processed_at is null;
