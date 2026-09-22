-- =============================================================================
-- Offtexts — partner cafes
-- =============================================================================
-- The venues meets happen at. Three tables rather than one wide one, because
-- the three things change on completely different schedules: a cafe's address
-- almost never, its contact person a few times a year, its opening hours
-- seasonally.
--
-- This is what the admin portal's Cafés section has been waiting for. It was
-- shipped as a page explaining what it needed rather than a mocked table,
-- precisely so that this migration could answer it rather than match it.
-- =============================================================================


-- ----------------------------------------------------------------- enums ----

-- The commercial relationship, which is not the same question as "is this cafe
-- open right now" — that is the hours table.
--
--   prospect — talked to, not signed. Never shown to members.
--   active   — signed and taking bookings.
--   paused   — temporarily not taking bookings (renovation, staffing, a
--              seasonal close). Existing meets stand; new ones are blocked.
--   ended    — the partnership is over. Kept, not deleted, because past meets
--              still reference it and history should stay readable.
create type cafe_status as enum ('prospect', 'active', 'paused', 'ended');


-- ----------------------------------------------------------------- cafes ----

create table public.cafes (
  id uuid primary key default gen_random_uuid(),

  name text not null check (char_length(trim(name)) between 2 and 120),

  -- Stable, human-readable, URL-safe. Used in links and in anything a partner
  -- sees; the uuid is an implementation detail nobody should have to read out
  -- over the phone.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  status cafe_status not null default 'prospect',

  -- --- where it is ----------------------------------------------------------

  address_line text not null check (char_length(trim(address_line)) between 5 and 300),

  -- Matches meets.venue_area, which already exists and is already displayed.
  -- Same vocabulary in both places, so "Koregaon Park" means one thing.
  area text not null check (char_length(trim(area)) between 2 and 80),
  city text not null check (char_length(trim(city)) > 0),
  postal_code text check (postal_code ~ '^[0-9]{6}$'),

  -- numeric, not float: coordinates are compared and grouped, and a float that
  -- does not round-trip turns two records of the same place into two places.
  -- Six decimal places is ~0.11 m at the equator, far past what a cafe needs.
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),

  maps_url text check (maps_url ~ '^https://'),

  -- --- how to reach it ------------------------------------------------------

  phone text check (phone ~ '^\+?[0-9][0-9 ()-]{6,19}$'),

  -- --- the arrangement ------------------------------------------------------

  -- How many Offtexts meets the cafe is happy to host at the same time. The
  -- scheduler needs a number here or it will book six pairs into a room with
  -- four tables.
  concurrent_meet_capacity int not null default 2
    check (concurrent_meet_capacity between 1 and 50),

  partner_since date,
  partner_until date,

  -- Razorpay Route linked account, for the day Offtexts passes a share of the
  -- booking fee to the cafe rather than settling by invoice. Nullable and
  -- unused today — added now because adding a column to an empty table is free
  -- and adding one to a table with live payment history is not.
  razorpay_linked_account_id text unique check (razorpay_linked_account_id ~ '^acc_[A-Za-z0-9]+$'),

  notes text check (char_length(notes) <= 2000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cafes_partnership_dates_ordered check (
    partner_until is null or partner_since is null or partner_since <= partner_until
  ),

  -- Either both coordinates or neither. One of the two is not a location, and
  -- the distance function would silently return null for it forever.
  constraint cafes_coordinates_paired check (
    (latitude is null) = (longitude is null)
  ),

  -- An active partner has to be bookable, and being bookable means the app can
  -- tell a member where to go.
  constraint cafes_active_is_locatable check (
    status <> 'active' or (latitude is not null and phone is not null)
  )
);

comment on table public.cafes is
  'Partner venues. status is the commercial relationship; cafe_hours is when the doors are open.';

-- Members browse bookable cafes in their city. Partial, because prospects and
-- ended partnerships are never in that list and there is no reason to index
-- them for it.
create index cafes_bookable_idx
  on public.cafes (city, area, name)
  where status = 'active';

create index cafes_status_idx on public.cafes (status, name);


create trigger cafes_set_updated_at
  before update on public.cafes
  for each row execute function public.set_updated_at();


-- -------------------------------------------------------- cafe contacts -----

-- "Contact manager" from the ticket. A person, not a phone number on the cafe
-- row: cafes have a manager and an owner and sometimes a head of marketing,
-- they change, and the one you should ring about a booking is not always the
-- one you should ring about an invoice.
create table public.cafe_contacts (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,

  name text not null check (char_length(trim(name)) between 2 and 120),
  role text check (char_length(trim(role)) between 2 and 60),

  phone text check (phone ~ '^\+?[0-9][0-9 ()-]{6,19}$'),
  email text check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),

  is_primary boolean not null default false,
  notes text check (char_length(notes) <= 1000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A contact you cannot contact is a note, not a contact.
  constraint cafe_contacts_reachable check (phone is not null or email is not null)
);

create index cafe_contacts_cafe_idx on public.cafe_contacts (cafe_id, is_primary desc, name);

-- At most one primary per cafe. A partial unique index rather than a
-- constraint, because "unique among the rows where this is true" is not
-- something UNIQUE can express.
create unique index cafe_contacts_one_primary
  on public.cafe_contacts (cafe_id)
  where is_primary;

create trigger cafe_contacts_set_updated_at
  before update on public.cafe_contacts
  for each row execute function public.set_updated_at();


-- ----------------------------------------------------------- cafe hours -----

create table public.cafe_hours (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,

  -- ISO-8601: 1 = Monday … 7 = Sunday. Same numbering as public.availability
  -- and as extract(isodow from …), so matching a proposed meeting time against
  -- both a member's window and the cafe's hours is one comparison.
  weekday int not null check (weekday between 1 and 7),

  opens_at time not null,
  closes_at time not null,

  created_at timestamptz not null default now(),

  -- A cafe open until 1am is stored as two rows — 18:00-23:59 on Friday and
  -- 00:00-01:00 on Saturday — rather than as a window that wraps. Wrapping
  -- windows make every "is it open at T" query a two-case expression, in every
  -- place that asks, forever.
  constraint cafe_hours_ordered check (opens_at < closes_at),
  constraint cafe_hours_no_duplicate unique (cafe_id, weekday, opens_at)
);

comment on table public.cafe_hours is
  'Opening hours per weekday. A window crossing midnight is two rows; see the constraint comment.';

create index cafe_hours_cafe_idx on public.cafe_hours (cafe_id, weekday, opens_at);


-- -------------------------------------------------------------- distance ----

-- Great-circle distance in kilometres.
--
-- Haversine rather than PostGIS. PostGIS is the right answer for polygons,
-- routing or anything geographic beyond "how far apart are these two points",
-- and it is a large extension to carry for a question this small. At city
-- scale the error against a proper geodesic is metres.
--
-- IMMUTABLE so it can be used in an index or a generated column later; it
-- depends on nothing but its arguments.
create or replace function public.distance_km(
  lat1 numeric, lon1 numeric,
  lat2 numeric, lon2 numeric
)
returns numeric
language sql
immutable
parallel safe
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else round((
      6371 * 2 * asin(sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2)
        + cos(radians(lat1)) * cos(radians(lat2))
        * power(sin(radians(lon2 - lon1) / 2), 2)
      ))
    )::numeric, 2)
  end;
$$;

comment on function public.distance_km(numeric, numeric, numeric, numeric) is
  'Great-circle distance in km between two lat/lon pairs. NULL if any argument is NULL.';
